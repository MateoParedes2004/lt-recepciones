/**
 * Nombre del rubro de manteles. Lo usan:
 *  - el color opcional de cada renglón de un alquiler (ver acceptsColor), y
 *  - la estadística "alquileres sin manteles".
 * Si se renombra el rubro en el panel, hay que actualizar esta constante (y
 * la copia en frontend/src/lib/manteles.ts).
 */
export const MANTELES_CATEGORY_NAME = 'Manteles';

/** Sin tildes, mayúsculas ni espacios de más: "  manteles " también es el rubro de manteles. */
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function isManteles(categoryName: string | null | undefined): boolean {
  return !!categoryName && norm(categoryName) === norm(MANTELES_CATEGORY_NAME);
}

/** Servilletas: el rubro "Servilletas" o cualquier producto cuyo nombre diga "servilleta(s)". */
export function isServilletas(name: string | null | undefined): boolean {
  return !!name && norm(name).includes('servilleta');
}

/**
 * ¿Este producto lleva color elegido por el cliente? Los manteles (por rubro) y
 * las servilletas (por rubro o por nombre del producto: hoy están dentro de
 * "Cubiertos y complementos"). Copia en frontend/src/lib/manteles.ts.
 */
export function acceptsColor(
  categoryName: string | null | undefined,
  productName: string | null | undefined,
): boolean {
  return isManteles(categoryName) || isServilletas(categoryName) || isServilletas(productName);
}
