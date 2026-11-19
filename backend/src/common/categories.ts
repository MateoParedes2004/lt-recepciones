/**
 * Nombre del rubro de manteles. Lo usan:
 *  - el color opcional de cada renglón de un alquiler (solo se puede indicar
 *    en productos de este rubro), y
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
