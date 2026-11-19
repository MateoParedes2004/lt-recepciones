// Color opcional de los productos del rubro "Manteles" en un alquiler.
// Espejo de backend/src/common/categories.ts: si se renombra el rubro en el
// panel, hay que cambiar el nombre en los dos lados.

export const MANTELES_CATEGORY_NAME = "Manteles";
/** Largo máximo del color (igual que el backend). */
export const MAX_COLOR_LENGTH = 40;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** ¿Este nombre de rubro es el de manteles? (sin importar mayúsculas ni tildes) */
export function isMantelesCategory(categoryName: string | null | undefined): boolean {
  return !!categoryName && norm(categoryName) === norm(MANTELES_CATEGORY_NAME);
}

/**
 * "Mantel para Tablón" + "Negro" → "Mantel para Tablón (Negro)". Sin color, el
 * nombre tal cual. Si el total pasara del máximo (las descripciones de una
 * factura admiten 150), se acorta el nombre del producto y se conserva el
 * color, que es lo que el cliente eligió.
 */
export function describeWithColor(name: string, color: string | null | undefined, max = 150): string {
  const c = color?.trim();
  if (!c) return name;
  const suffix = ` (${c})`;
  if (name.length + suffix.length <= max) return `${name}${suffix}`;
  return `${name.slice(0, Math.max(0, max - suffix.length - 1)).trimEnd()}…${suffix}`;
}
