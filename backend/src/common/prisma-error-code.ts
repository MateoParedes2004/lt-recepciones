import { Prisma } from '@prisma/client';

/**
 * Código de error "P2xxx" de Prisma, sin importar bajo qué forma haya
 * llegado la excepción.
 *
 * El caso normal (P2002 duplicado, P2025 no existe, etc.) llega como
 * `Prisma.PrismaClientKnownRequestError` con `.code`. PERO: con el adaptador
 * de Postgres que usa este proyecto (@prisma/adapter-pg, necesario desde
 * Prisma 7), una violación de "ON DELETE RESTRICT" —como la que protege a
 * Category de que la borren con productos todavía apuntándole— no pasa por
 * esa traducción: llega como `DriverAdapterError`, con el código CRUDO de
 * Postgres (no el de Prisma) adentro de `.cause.code`. Esta función reconoce
 * ambas formas y siempre devuelve el código "P2xxx" que el resto del backend
 * ya sabe interpretar, para no tener que conocer este detalle en cada lugar
 * que necesite distinguir estos errores.
 *
 * Verificado a mano contra una base real (ver auditoría): P2002 SÍ llega
 * traducido normalmente; P2003 (clave foránea) con un RESTRICT explícito —
 * que es lo que genera Prisma hoy en una relación obligatoria sin onDelete,
 * como Product.category— NO.
 */
export function prismaErrorCode(exception: unknown): string | null {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    return exception.code;
  }

  const rawCode = (exception as { cause?: { code?: unknown } } | null)?.cause?.code;
  if (typeof rawCode !== 'string') return null;

  switch (rawCode) {
    case '23503': // foreign_key_violation (NO ACTION, el default implícito de Postgres)
    case '23001': // restrict_violation (ON DELETE RESTRICT explícito)
      return 'P2003';
    case '23505': // unique_violation — no hace falta hoy (P2002 ya llega traducido),
      return 'P2002'; // pero cubrirlo acá es barato y evita sorpresas si eso cambia.
    default:
      return null;
  }
}
