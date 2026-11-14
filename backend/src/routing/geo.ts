/**
 * Geografía básica del negocio: puntos, el depósito y distancias en línea
 * recta. Sin dependencias (ni Nest ni Prisma) para poder reutilizarlo tal cual
 * en la futura app de recorridos de entrega.
 */

/** Un punto en el mapa, en grados decimales (WGS84, el mismo sistema que Google Maps). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Depósito: de acá salen (y vuelven) todos los pedidos. Es el origen de cada
 * cálculo de km de envío. Si el depósito se muda, se cambia SOLO acá.
 *
 * Ojo: no es la ubicación pública del negocio (BUSINESS.geo en
 * frontend/src/lib/site.ts, la que ve Google). Las dos se mantienen aparte.
 */
export const DEPOT: GeoPoint & { label: string } = {
  lat: -25.312296,
  lng: -57.601444,
  label: 'Depósito (Aztecas 877, Asunción)',
};

/**
 * Cuánto más larga que la línea recta suele ser la ruta por calle en una
 * ciudad. Solo se usa como estimación cuando el servicio de rutas no está
 * configurado o no responde; el panel muestra esos km como "aproximados".
 */
export const ROAD_FACTOR = 1.3;

/** Más lejos que esto del depósito casi seguro es un error de carga (signo menos olvidado, lat/lng invertidas). */
export const MAX_KM_FROM_DEPOT = 1000;

export function isValidPoint(p: GeoPoint): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    // (0, 0) es lo que devuelven muchos sistemas cuando "no hay ubicación".
    !(p.lat === 0 && p.lng === 0)
  );
}

/** Distancia en línea recta (km) sobre la superficie de la Tierra. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Km con un decimal: más precisión que eso no cambia el precio y solo confunde. */
export function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}

/** Coordenadas con 6 decimales (~10 cm): lo que se guarda en la base. */
export function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
