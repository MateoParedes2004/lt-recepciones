import type { GeoPoint } from '../geo';

/** Un tramo por calle entre dos puntos. */
export interface RouteLeg {
  distanceMeters: number;
  /** Tiempo estimado manejando, si el servicio lo informa. */
  durationSeconds: number | null;
}

/**
 * Quién calcula la ruta por calle. Hoy existe Geoapify (gratis, permite uso
 * comercial). Para cambiar de servicio se agrega otra clase que implemente
 * esta interfaz y se elige en routing.module.ts, sin tocar el resto del
 * sistema — igual que InvoiceProvider con la facturación.
 *
 * Para la futura app de recorridos, acá se sumarían `matrix` (km entre todos
 * los puntos de un día) y `optimize` (orden de paradas más corto); Geoapify
 * ofrece las dos cosas (Route Matrix y Route Planner).
 */
export interface RouteProvider {
  /** Nombre que se muestra en el panel junto al resultado (lo exige la licencia de algunos servicios). */
  readonly name: string;
  /** Lanza un error si no se pudo calcular (sin red, sin cuota, punto sin calles cerca…). */
  route(from: GeoPoint, to: GeoPoint): Promise<RouteLeg>;
}

export const ROUTE_PROVIDER = Symbol('ROUTE_PROVIDER');
