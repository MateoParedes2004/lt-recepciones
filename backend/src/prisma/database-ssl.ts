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
