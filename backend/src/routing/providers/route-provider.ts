import type { GeoPoint } from '../geo';

/** Un tramo por calle entre dos puntos. */
export interface RouteLeg {
  distanceMeters: number;
  /** Tiempo estimado manejando, si el servicio lo informa. */
  durationSeconds: number | null;
}

/**
 * Tiempos y distancias entre todos los pares de una lista de puntos.
 * `durationSec[i][j]` es el viaje de i a j (la ida y la vuelta pueden diferir
 * por los sentidos de calle). Un par sin ruta por calle viene como `null`.
 */
export interface TravelMatrix {
  durationSec: (number | null)[][];
  distanceM: (number | null)[][];
}

/**
 * Quién calcula las rutas por calle. Hoy existe Geoapify (gratis). Para cambiar
 * de servicio se agrega otra clase que implemente esta interfaz y se elige en
 * routing.module.ts, sin tocar el resto del sistema — igual que InvoiceProvider
 * con la facturación.
 */
export interface RouteProvider {
  /** Nombre que se muestra en el panel junto al resultado (lo exige la licencia de algunos servicios). */
  readonly name: string;
  /** Cuántos puntos admite `matrix` en una sola consulta. */
  readonly maxMatrixPoints: number;
  /** Lanza un error si no se pudo calcular (sin red, sin cuota, punto sin calles cerca…). */
  route(from: GeoPoint, to: GeoPoint): Promise<RouteLeg>;
  /** Todos los tiempos y distancias entre los puntos, en una consulta. Lanza un error si falla. */
  matrix(points: GeoPoint[]): Promise<TravelMatrix>;
}

export const ROUTE_PROVIDER = Symbol('ROUTE_PROVIDER');
