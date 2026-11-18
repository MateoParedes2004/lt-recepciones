import type { PoolConfig } from 'pg';

/**
 * Configuración del pool de Postgres a partir de DATABASE_URL.
 *
 * Algunos proveedores (ej. Aiven) firman el certificado de su base con una
 * entidad propia que Node no conoce. Con `sslmode=require` en la URL, `pg`
 * valida el certificado y la conexión falla ("unable to verify the first
 * certificate"). Si se define DATABASE_CA_CERT (el certificado CA que da el
 * proveedor, en texto), la conexión se verifica contra ESE certificado: sigue
 * cifrada y verificada, y un certificado ajeno se rechaza.
 *
 * Sin DATABASE_CA_CERT no cambia nada respecto a antes (ej. Neon, que usa una
 * entidad pública).
 */
export function poolConfigFor(
  databaseUrl: string | undefined,
  caCert: string | undefined,
): PoolConfig {
  const ca = normalizePem(caCert);
  if (!databaseUrl || !ca) return { connectionString: databaseUrl };

  // `pg` deja que lo que diga la URL pise la configuración de cifrado: hay que
  // quitar esos parámetros para que valga el `ssl` de acá.
  const url = new URL(databaseUrl);
  for (const param of [
    'sslmode',
    'sslrootcert',
    'sslcert',
    'sslkey',
    'sslaccept',
    'uselibpqcompat',
    'channel_binding',
  ]) {
    url.searchParams.delete(param);
  }
  return {
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true },
  };
}

/** Los paneles de variables de entorno a veces aplastan los saltos de línea: acepta "\n" escrito literal. */
function normalizePem(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  return value.replace(/\\n/g, '\n');
}

/** Conexiones por defecto del backend (ver poolLimits). */
export const DEFAULT_POOL_MAX = 4;

/**
 * Cuántas conexiones abre el backend y cuánto las mantiene.
 *
 * El plan gratis de Aiven tiene 1 GB de RAM y un tope de 20 conexiones, y
 * cada conexión es un proceso de Postgres que ocupa memoria. Con el valor por
 * defecto de `pg` (10), abrir el panel —que pide ~10 datos en paralelo— podía
 * crear 10 procesos de golpe, y durante un despliegue en Render (la versión
 * vieja y la nueva conviven unos segundos) hasta 20. Aiven avisó "running low
 * on memory" y el kernel mató un proceso. Con 4 alcanza: las consultas duran
 * milisegundos y los pedidos que sobran esperan su turno.
 *
 * - DATABASE_POOL_MAX (opcional, 1–20) permite subirlo con un plan más grande.
 * - idleTimeoutMillis 30 s: no cerrar y volver a abrir procesos a cada rato.
 * - connectionTimeoutMillis 15 s: si la base no responde (ej. Aiven apagada),
 *   el pedido falla con un error en vez de quedar colgado para siempre.
 * - application_name: así se reconocen estas conexiones en el panel de Aiven.
 */
export function poolLimits(maxFromEnv: string | undefined): PoolConfig {
  const parsed = Number(maxFromEnv);
  const max =
    Number.isInteger(parsed) && parsed >= 1 && parsed <= 20
      ? parsed
      : DEFAULT_POOL_MAX;
  return {
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    application_name: 'lt-backend',
  };
}
