import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Migración de datos de una sola vez: al agregar Category.sortOrder, todos los
 * rubros existentes quedaron en 0. Para que sigan en el mismo orden de siempre
 * se les asigna id × 10 (el orden viejo era por id). Así queda espacio entre
 * uno y otro para ubicar un rubro nuevo justo después de otro (por ejemplo,
 * Manteles debajo de Mesas).
 *
 * Corre una sola vez: la marca en AppMeta se reclama en la misma transacción.
 * A diferencia de la migración de stock, si falla NO tira abajo el backend:
 * el orden de los rubros no es crítico, así que solo se registra el error.
 */
const MARKER = 'category_order_v1';

@Injectable()
export class CategoryOrderMigration implements OnModuleInit {
  private readonly logger = new Logger('CategoryOrderMigration');

  constructor(private prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.$executeRaw`
          INSERT INTO "AppMeta" ("key", "value") VALUES (${MARKER}, 'migrated')
          ON CONFLICT ("key") DO NOTHING`;
        if (claimed === 0) return; // ya se hizo antes

        const updated = await tx.$executeRaw`
          UPDATE "Category" SET "sortOrder" = "id" * 10`;
        this.logger.log(`Orden de rubros inicializado en ${updated} rubro(s).`);
      });
    } catch (error) {
      this.logger.error(
        'No se pudo inicializar el orden de los rubros. Si falta la columna sortOrder, el catálogo no se puede leer: corré "npx prisma db push" (el build de Render lo hace solo).',
        (error as Error).stack,
      );
    }
  }
}
