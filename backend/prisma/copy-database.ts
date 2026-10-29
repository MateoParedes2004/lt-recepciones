import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import * as dotenv from 'dotenv';

dotenv.config();

// Copia TODA la base de datos (catálogo, alquileres, pedidos, usuarios,
// estadísticas...) de una base Postgres a otra: pensado para mudarse de un
// proveedor a otro (ej. de Neon a Aiven) sin perder nada.
//
//   ORIGEN  = SOURCE_DATABASE_URL (la base actual, ej. la de Neon)
//   DESTINO = TARGET_DATABASE_URL (la base nueva, recién creada)
//   (opcional) SOURCE_CA_FILE / TARGET_CA_FILE = archivo .pem con el certificado
//   del proveedor; sin él se conecta cifrado pero sin verificar el certificado.
//
// Pasos:
//   1) En el destino, crear las tablas VACÍAS:   npx prisma db push
//      (con DATABASE_URL apuntando al destino). El backend NO tiene que haber
//      arrancado contra el destino todavía: al arrancar ya escribe filas.
//   2) Simulación (no deja nada guardado):       npx ts-node prisma/copy-database.ts
//   3) Copia de verdad:                          npx ts-node prisma/copy-database.ts --yes
//   4) Recién entonces, apuntar DATABASE_URL de Render al destino.
//
// Garantías:
//  - Nunca pisa datos: si el destino tiene algo en cualquier tabla, se detiene.
//  - Todo o nada: una sola transacción. La simulación hace la copia completa
//    (así comprueba que de verdad entra) y al final la deshace.
//  - Lee el origen en una foto consistente (una sola transacción de lectura).
//  - Las filas viajan como texto exacto entre las dos bases, sin pasar por
//    fechas de JavaScript: no hay corrimiento de zona horaria ni de decimales.
//  - Verifica, antes de guardar, que cada tabla quedó idéntica (cantidad de
//    filas y una huella de todo su contenido). Si algo difiere, no guarda nada.
//  - Conserva los ids y deja las secuencias listas para lo que se cree después.

const write = process.argv.includes('--yes');

// Las tablas a las que otras apuntan (claves foráneas) van antes.
const TABLES = [
  'Category',
  'City',
  'Product',
  'User',
  'Rental',
  'RentalItem',
  'SiteVisit',
  'SiteMetric',
  'GalleryImage',
  'ShippingSettings',
  'CheckoutIntent',
  'CheckoutIntentItem',
  'AppMeta',
] as const;

// Columna con la que se ordena cada tabla (la clave primaria).
const KEY: Record<string, string> = { AppMeta: 'key' };
const keyOf = (table: string) => KEY[table] ?? 'id';

const CHUNK = 1000;

function connect(rawUrl: string, caFile?: string): Client {
  const url = new URL(rawUrl);
  // pg deja que lo que diga la URL pise la configuración de cifrado: se quitan
  // esos parámetros para decidirlo acá, de forma explícita.
  for (const p of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslaccept', 'uselibpqcompat', 'channel_binding']) {
    url.searchParams.delete(p);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const ssl = isLocal
    ? undefined
    : caFile
      ? { ca: readFileSync(caFile, 'utf8'), rejectUnauthorized: true }
      : { rejectUnauthorized: false };
  return new Client({ connectionString: url.toString(), ssl });
}

function sameDatabase(a: string, b: string): boolean {
  const ua = new URL(a);
  const ub = new URL(b);
  return ua.hostname === ub.hostname && (ua.port || '5432') === (ub.port || '5432') && ua.pathname === ub.pathname;
}

async function columnsOf(db: Client, table: string): Promise<string[]> {
  const res = await db.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY column_name`,
    [table],
  );
  return res.rows.map((r) => r.column_name as string);
}

/** Huella de todo el contenido de la tabla: si coincide en las dos bases, las filas son idénticas. */
async function fingerprint(db: Client, table: string): Promise<{ n: number; hash: string }> {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n, md5(COALESCE(string_agg(t::text, '|' ORDER BY t."${keyOf(table)}"), '')) AS hash FROM "${table}" t`,
  );
  return rows[0];
}

async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL;
  if (!sourceUrl) {
    throw new Error('Falta SOURCE_DATABASE_URL (la base ACTUAL).\n   PowerShell:  $env:SOURCE_DATABASE_URL = "postgresql://..."');
  }
  if (!targetUrl) {
    throw new Error('Falta TARGET_DATABASE_URL (la base NUEVA).\n   PowerShell:  $env:TARGET_DATABASE_URL = "postgresql://..."');
  }
  if (sameDatabase(sourceUrl, targetUrl)) throw new Error('El origen y el destino son la MISMA base de datos. Revisá las variables.');

  const source = connect(sourceUrl, process.env.SOURCE_CA_FILE);
  const target = connect(targetUrl, process.env.TARGET_CA_FILE);

  console.log(`Origen : ${new URL(sourceUrl).hostname}${new URL(sourceUrl).pathname}`);
  console.log(`Destino: ${new URL(targetUrl).hostname}${new URL(targetUrl).pathname}`);
  console.log(write ? 'Modo   : COPIA DE VERDAD\n' : 'Modo   : simulación (no queda nada guardado)\n');

  try {
    await source.connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `No se pudo conectar al ORIGEN: ${msg}` +
        (/quota/i.test(msg) ? '\n   La base de origen sigue sin cuota: esperá al reinicio del ciclo y reintentá.' : ''),
    );
  }
  await target.connect();

  try {
    // 1) El esquema tiene que ser idéntico en las dos bases.
    for (const table of TABLES) {
      const [sc, tc] = await Promise.all([columnsOf(source, table), columnsOf(target, table)]);
      if (tc.length === 0) {
        throw new Error(`En el destino no existe la tabla "${table}". Corré antes "npx prisma db push" apuntando al destino.`);
      }
      if (sc.length === 0) throw new Error(`En el origen no existe la tabla "${table}".`);
      const onlySource = sc.filter((c) => !tc.includes(c));
      const onlyTarget = tc.filter((c) => !sc.includes(c));
      if (onlySource.length || onlyTarget.length) {
        throw new Error(
          `La tabla "${table}" tiene columnas distintas.\n` +
            (onlySource.length ? `   Solo en el origen : ${onlySource.join(', ')}\n` : '') +
            (onlyTarget.length ? `   Solo en el destino: ${onlyTarget.join(', ')}\n` : '') +
            '   Hay que dejar las dos con el mismo esquema (npx prisma db push) antes de copiar.',
        );
      }
    }

    // 2) El destino tiene que estar vacío.
    for (const table of TABLES) {
      const { rows } = await target.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
      if (rows[0].n > 0) {
        throw new Error(
          `El destino ya tiene ${rows[0].n} fila(s) en "${table}". Por seguridad no se toca nada: este script solo llena bases vacías.\n` +
            '   (Si el backend ya arrancó contra el destino, creó filas propias: usá una base recién creada.)',
        );
      }
    }

    // 3) Foto consistente del origen + copia en una transacción del destino.
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await target.query('BEGIN');
    const summary: { table: string; n: number }[] = [];
    try {
      for (const table of TABLES) {
        const { rows } = await source.query(`SELECT row_to_json(t)::text AS j FROM "${table}" t ORDER BY t."${keyOf(table)}"`);
        const json = rows.map((r) => r.j as string);
        for (let i = 0; i < json.length; i += CHUNK) {
          await target.query(
            `INSERT INTO "${table}" SELECT * FROM jsonb_populate_recordset(null::"${table}", $1::jsonb)`,
            [`[${json.slice(i, i + CHUNK).join(',')}]`],
          );
        }
        // Deja la secuencia del id después del mayor copiado (las tablas sin id serial se saltean).
        const hasId = (await columnsOf(target, table)).includes('id');
        if (hasId) {
          const seq = (await target.query(`SELECT pg_get_serial_sequence('"${table}"', 'id') AS seq`)).rows[0].seq as string | null;
          if (seq) {
            await target.query(
              `SELECT setval($1, COALESCE((SELECT MAX("id") FROM "${table}"), 1), (SELECT MAX("id") FROM "${table}") IS NOT NULL)`,
              [seq],
            );
          }
        }
        summary.push({ table, n: json.length });
      }

      // 4) Verificación: cada tabla tiene que haber quedado idéntica.
      const problems: string[] = [];
      for (const table of TABLES) {
        const [a, b] = [await fingerprint(source, table), await fingerprint(target, table)];
        if (a.n !== b.n || a.hash !== b.hash) {
          problems.push(`${table}: origen ${a.n} filas (${a.hash.slice(0, 8)}) ≠ destino ${b.n} filas (${b.hash.slice(0, 8)})`);
        }
      }
      if (problems.length) throw new Error(`La verificación falló, no se guardó nada:\n   ${problems.join('\n   ')}`);

      if (write) await target.query('COMMIT');
      else await target.query('ROLLBACK');
    } catch (error) {
      await target.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      await source.query('ROLLBACK').catch(() => undefined);
    }

    console.log(write ? '✅ Copiado y verificado (cada tabla quedó idéntica):' : 'Simulación correcta: se copiaría esto y cada tabla quedaría idéntica:');
    for (const s of summary) console.log(`  ${s.table.padEnd(20)} ${s.n}`);
    if (write) {
      console.log('\nSiguiente paso: apuntar DATABASE_URL del backend (Render) a la base nueva y redesplegar.');
    } else {
      console.log('\nNo se guardó nada. Para copiar de verdad, repetí con:  npx ts-node prisma/copy-database.ts --yes');
    }
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((e) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
