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
// P1001/P1002: servidor inalcanzable o sin respuesta a tiempo; P1008/P1017: cortó la conexión.
const CONNECTION_ERROR_CODES = ['P1001', 'P1002', 'P1008', 'P1017'];

// Presupuesto total para reintentar una falla de CONEXIÓN antes de rendirse.
// Con la base en Neon (se "duerme" tras un rato sin uso, como Render) el
// primer arranque después de la siesta puede tardar unos segundos en
// responder — antes esperábamos 30 s fijos y si no alcanzaba, el proceso se
// apagaba solo (process.exit en main.ts), lo que Render reporta como
// "Instance failed" y reinicia: un reinicio innecesario y ruidoso para algo
// que con un poco más de paciencia se resuelve solo. 10 minutos es tiempo de
// sobra para una demora real (Neon despierta en segundos, no minutos); pasado
// eso sí es una caída de verdad y conviene que se note.
const MAX_CONNECT_WAIT_MS = 10 * 60 * 1000;
// Entre intentos: arranca rápido (3 s, para no notar una demora corta) y va
// espaciándose hasta un máximo de 30 s si el problema persiste.
const INITIAL_RETRY_DELAY_MS = 3000;
const MAX_RETRY_DELAY_MS = 30000;

const isConnectionError = (error: unknown) =>
  CONNECTION_ERROR_CODES.includes((error as { code?: string })?.code ?? '');

@Injectable()
export class StockModelMigration implements OnModuleInit {
  private readonly logger = new Logger('StockModelMigration');

  constructor(private prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const startedAt = Date.now();
    let delay = INITIAL_RETRY_DELAY_MS;

    for (let attempt = 1; ; attempt++) {
      try {
        await this.migrate();
        return;
      } catch (error) {
        const unreachable = isConnectionError(error);
        const elapsed = Date.now() - startedAt;

        if (unreachable && elapsed < MAX_CONNECT_WAIT_MS) {
          this.logger.warn(
            `La base de datos no responde todavía (intento ${attempt}, ${Math.round(elapsed / 1000)} s transcurridos). Reintento en ${Math.round(delay / 1000)} s…`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
          continue;
        }
        this.logger.error(
          unreachable
            ? `No se pudo conectar a la base de datos tras ${Math.round(elapsed / 1000)} s de reintentos. Revisá en Render/Neon que la base esté activa, en la misma región que este servicio, y que DATABASE_URL sea la vigente.`
            : 'No se pudo verificar la migración del modelo de stock. Si falta la tabla AppMeta, corré "npx prisma db push".',
          (error as Error).stack,
        );
        throw error;
      }
    }
  }

  private async migrate(): Promise<void> {
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
      this.logger.log(
        `Modelo de stock por fecha activado: inventario físico recalculado en ${updated} producto(s).`,
      );
    });
  }
}
