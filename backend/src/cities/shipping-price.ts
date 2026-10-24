/**
 * Fórmula del costo de envío según los km por ruta desde el local.
 *
 * Gemela de frontend/src/lib/shipping.ts (el panel la usa para mostrar la
 * vista previa al instante): si se cambia una, cambiar la otra. El precio que
 * se guarda siempre lo calcula esta, en el servidor.
 */
export interface ShippingFormula {
  /** Gs. por km dentro del tramo normal. */
  pricePerKm: number;
  /** Por debajo de estos km el envío es gratis. */
  freeUnderKm: number;
  /** Desde estos km, cada km extra se cobra a longDistancePricePerKm. */
  longDistanceFromKm: number;
  longDistancePricePerKm: number;
  /** Más lejos que esto no hay precio automático: se coordina por WhatsApp. null = sin límite. */
  maxKm: number | null;
  /** El resultado se redondea hacia arriba a un múltiplo de esto (ej. 10.000). */
  roundTo: number;
}

export type ShippingQuote =
  | { kind: 'free'; price: 0 }
  | { kind: 'charged'; price: number }
  | { kind: 'coordinate'; price: 0 };

export function quoteShipping(km: number, f: ShippingFormula): ShippingQuote {
  if (km < f.freeUnderKm) return { kind: 'free', price: 0 };
  if (f.maxKm !== null && km > f.maxKm) return { kind: 'coordinate', price: 0 };

  const normalKm = Math.min(km, f.longDistanceFromKm);
  const longKm = Math.max(0, km - f.longDistanceFromKm);
  const raw = normalKm * f.pricePerKm + longKm * f.longDistancePricePerKm;
  // Redondeo sobre un entero de Gs.: evita que 70000.00000001 (error de coma
  // flotante de km × precio) suba un escalón entero a 80.000.
  const gs = Math.round(raw);
  const price = f.roundTo > 0 ? Math.ceil(gs / f.roundTo) * f.roundTo : gs;
  return { kind: 'charged', price };
}
