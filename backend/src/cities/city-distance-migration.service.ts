import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cityRoadKm } from './city-distances';
import { cityRoadKmV1 } from './city-distances-v1';
import { ShippingSettingsService } from './shipping-settings.service';

/**
 * Migración de datos de una sola vez por versión: carga los km por ruta desde
 * el depósito (calculados con prisma/compute-city-distances.mjs) en las
 * ciudades. Actualiza una ciudad solo si:
 *  - todavía no tiene km, o
 *  - tiene exactamente el valor de la tabla anterior (city-distances-v1.ts):
 *    nadie lo corrigió a mano, así que es seguro reemplazarlo.
 * Un km que el admin editó en el panel NO se toca.
 *
 * No cambia ningún precio por sí sola: las ciudades con precio a mano siguen
 * igual. Las que ya usan la fórmula de envío (priceFromFormula) se recalculan
 * en la misma transacción, porque su precio sale de los km.
 *
 * Corre una sola vez (marca en AppMeta, en la misma transacción): así, si el
 * admin borra los km de una ciudad a propósito, no reaparecen al reiniciar. Si
 * falla solo se registra (no tira abajo el backend), como CategoryOrderMigration.
 *
 * Para aplicar una tabla nueva: congelar la actual como city-distances-v2.ts,
 * regenerar city-distances.ts y cambiar MARKER (y la tabla "anterior" de abajo).
 */
const MARKER = 'city_distances_v2';

// Dos km "iguales" a un decimal: tolera el redondeo con el que se guardaron.
const SAME_KM = 0.05;
// Ciudad que no estaba en la tabla anterior: no hay valor viejo que reconocer.
const NO_PREVIOUS = -1;

@Injectable()
export class CityDistanceMigration implements OnModuleInit {
  private readonly logger = new Logger('CityDistanceMigration');

  constructor(
    private prisma: PrismaService,
    private shipping: ShippingSettingsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const names = Object.keys(cityRoadKm);
    const kms = Object.values(cityRoadKm);
    const previous = names.map((name) => cityRoadKmV1[name] ?? NO_PREVIOUS);
    try {
      // Se corre contra una base remota al arrancar: el límite por defecto de
      // Prisma (5 s) es justo si la base está "dormida" y despierta con la
      // primera consulta. Mismo margen que el resto de las transacciones.
      await this.prisma.$transaction(
        async (tx) => {
          const done = await tx.appMeta.findUnique({ where: { key: MARKER } });
          if (done) return;

          // Sin ciudades todavía (base recién creada, antes del seed) no se
          // marca como hecha: si no, esos km no se cargarían nunca.
          if ((await tx.city.count()) === 0) return;

          const updated = await tx.$executeRaw`
          UPDATE "City" AS c SET "distanceKm" = d.km, "updatedAt" = now()
          FROM unnest(${names}::text[], ${kms}::float8[], ${previous}::float8[]) AS d(name, km, prev)
          WHERE c."name" = d.name
            AND c."distanceKm" IS DISTINCT FROM d.km
            AND (
              c."distanceKm" IS NULL
              OR (d.prev >= 0 AND abs(c."distanceKm" - d.prev) < ${SAME_KM})
            )`;

          const repriced = await this.shipping.recalculateFormulaCities(
            tx,
            await this.shipping.getFormula(tx),
          );

          await tx.$executeRaw`
          INSERT INTO "AppMeta" ("key", "value") VALUES (${MARKER}, 'migrated')
          ON CONFLICT ("key") DO NOTHING`;
          this.logger.log(
            `Km por ruta desde el depósito: ${updated} ciudad(es) actualizadas, ${repriced} con precio por fórmula recalculado.`,
          );
        },
        { timeout: 15000 },
      );
    } catch (error) {
      this.logger.error(
        'No se pudieron cargar los km de las ciudades. Si falta la columna distanceKm, corré "npx prisma db push" (el build de Render lo hace solo).',
        (error as Error).stack,
      );
    }
  }
}
