import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Migración de datos de una sola vez, al primer arranque con el modelo nuevo
 * de stock.
 *
 * Antes: Product.totalStock era "unidades libres ahora" (bajaba al alquilar y
 * subía al devolver) y el inventario físico era totalStock + rentedCount.
 * Ahora: Product.totalStock es el inventario FÍSICO y lo libre se calcula por
 * fecha desde los alquileres activos.
 *
 * Para no depender de un contador viejo que pudo haberse desviado, el físico
 * se reconstruye desde la fuente de verdad: lo libre que había + lo que
 * figura en alquileres ACTIVO. Corre una sola vez: la marca en AppMeta se
 * reclama en la misma transacción, así que reiniciar o levantar dos
 * instancias a la vez no la repite (repetirla inflaría el stock).
 */
@Injectable()
export class StockModelMigration implements OnModuleInit {
  private readonly logger = new Logger('StockModelMigration');

  constructor(private prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.$executeRaw`
          INSERT INTO "AppMeta" ("key", "value") VALUES ('stock_model_v2', 'migrated')
          ON CONFLICT ("key") DO NOTHING`;
        if (claimed === 0) return; // ya se hizo antes

        const updated = await tx.$executeRaw`
          UPDATE "Product" p
          SET "totalStock" = p."totalStock" + COALESCE((
            SELECT SUM(ri."quantity")
            FROM "RentalItem" ri
            JOIN "Rental" r ON r."id" = ri."rentalId"
            WHERE ri."productId" = p."id" AND r."status" = 'ACTIVO'
          ), 0)`;
        this.logger.log(`Modelo de stock por fecha activado: inventario físico recalculado en ${updated} producto(s).`);
      });
    } catch (error) {
      this.logger.error(
        'No se pudo verificar la migración del modelo de stock. ¿Corriste "npx prisma db push"? (falta la tabla AppMeta)',
        (error as Error).stack,
      );
      throw error;
    }
  }
}
