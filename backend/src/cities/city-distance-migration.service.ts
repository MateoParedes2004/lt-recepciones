import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { cityRoadKm } from './city-distances';

/**
 * Migración de datos de una sola vez: carga los km por ruta (calculados con
 * prisma/compute-city-distances.mjs) en las ciudades que todavía no los
 * tienen. NO toca ningún precio: las ciudades siguen con su precio a mano
 * hasta que el admin les aplique la fórmula desde Zonas de Entrega.
 *
 * Corre una sola vez (marca en AppMeta, en la misma transacción): así, si el
 * admin borra los km de una ciudad a propósito, no reaparecen al reiniciar. Si
 * falla solo se registra (no tira abajo el backend), como CategoryOrderMigration.
 */
const MARKER = 'city_distances_v1';

@Injectable()
export class CityDistanceMigration implements OnModuleInit {
  private readonly logger = new Logger('CityDistanceMigration');

  constructor(private prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const names = Object.keys(cityRoadKm);
    const kms = Object.values(cityRoadKm);
    try {
      await this.prisma.$transaction(async (tx) => {
        const done = await tx.appMeta.findUnique({ where: { key: MARKER } });
        if (done) return;

        const updated = await tx.$executeRaw`
          UPDATE "City" AS c SET "distanceKm" = d.km, "updatedAt" = now()
          FROM unnest(${names}::text[], ${kms}::float8[]) AS d(name, km)
          WHERE c."name" = d.name AND c."distanceKm" IS NULL`;
        // Sin ciudades todavía (base recién creada, antes del seed) no se
        // marca como hecha: si no, esos km no se cargarían nunca.
        if (updated === 0) return;

        await tx.$executeRaw`
          INSERT INTO "AppMeta" ("key", "value") VALUES (${MARKER}, 'migrated')
          ON CONFLICT ("key") DO NOTHING`;
        this.logger.log(`Km por ruta cargados en ${updated} ciudad(es).`);
      });
    } catch (error) {
      this.logger.error(
        'No se pudieron cargar los km de las ciudades. Si falta la columna distanceKm, corré "npx prisma db push" (el build de Render lo hace solo).',
        (error as Error).stack,
      );
    }
  }
}
