import type { ShippingSettings } from "../types";

/**
 * Gemela de backend/src/cities/shipping-price.ts: si se cambia una, cambiar
 * la otra. Acá solo se usa para mostrar vistas previas al instante; el precio
 * que se guarda en cada ciudad siempre lo calcula el servidor.
 */
export type ShippingQuote =
  | { kind: "free"; price: 0 }
  | { kind: "charged"; price: number }
  | { kind: "coordinate"; price: 0 };

export function quoteShipping(km: number, f: ShippingSettings): ShippingQuote {
  if (km < f.freeUnderKm) return { kind: "free", price: 0 };
  if (f.maxKm !== null && km > f.maxKm) return { kind: "coordinate", price: 0 };

  const normalKm = Math.min(km, f.longDistanceFromKm);
  const longKm = Math.max(0, km - f.longDistanceFromKm);
  const gs = Math.round(normalKm * f.pricePerKm + longKm * f.longDistancePricePerKm);
  const price = f.roundTo > 0 ? Math.ceil(gs / f.roundTo) * f.roundTo : gs;
  return { kind: "charged", price };
}
