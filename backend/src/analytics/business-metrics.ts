/**
 * Cálculos de negocio para Estadísticas, sin base de datos (funciones puras:
 * reciben filas ya leídas y devuelven números). Así se pueden probar solos.
 *
 * Fechas: eventDate/returnDate son fechas de CALENDARIO (medianoche UTC por
 * convención) y se manejan como "índice de día" (toDayIndex de common/timezone.ts).
 * createdAt sí es un instante real: quien llama lo pasa ya convertido al día
 * de Paraguay.
 */

export interface MetricItem {
  productId: number;
  quantity: number;
}

export interface MetricRental {
  status: string;
  /** Índices de día (toDayIndex). */
  eventDay: number;
  returnDay: number;
  items: MetricItem[];
}

export interface ProductOccupancy {
  /** Unidades × días alquiladas dentro del período. */
  unitDays: number;
  /** Mayor cantidad de unidades afuera en un mismo día del período. */
  peakUnits: number;
  /** Índice del día de ese pico (null si nunca salió). */
  peakDay: number | null;
}

/**
 * Cuánto se usó cada producto en [from, to] (índices de día, inclusive).
 * Misma regla que AvailabilityService: un alquiler ocupa desde el día del
 * evento hasta el de devolución, ambos inclusive; si sigue ACTIVO con la
 * devolución vencida, ocupa hasta hoy. Cuentan los ACTIVO y los DEVUELTO (los
 * que salieron de verdad); presupuestos y anulados no.
 */
export function productOccupancy(
  rentals: MetricRental[],
  from: number,
  to: number,
  today: number,
): Map<number, ProductOccupancy> {
  const length = to - from + 1;
  const deltas = new Map<number, Int32Array>();
  if (length <= 0) return new Map();

  for (const r of rentals) {
    if (r.status !== 'ACTIVO' && r.status !== 'DEVUELTO') continue;
    const end =
      r.status === 'ACTIVO' ? Math.max(r.returnDay, today) : r.returnDay;
    const start = Math.max(r.eventDay, from);
    const stop = Math.min(end, to);
    if (stop < start) continue;
    for (const item of r.items) {
      if (item.quantity <= 0) continue;
      let d = deltas.get(item.productId);
      if (!d) {
        d = new Int32Array(length + 1);
        deltas.set(item.productId, d);
      }
      d[start - from] += item.quantity;
      d[stop - from + 1] -= item.quantity;
    }
  }

  const result = new Map<number, ProductOccupancy>();
  for (const [productId, d] of deltas) {
    let current = 0;
    let unitDays = 0;
    let peakUnits = 0;
    let peakDay: number | null = null;
    for (let i = 0; i < length; i++) {
      current += d[i];
      unitDays += current;
      if (current > peakUnits) {
        peakUnits = current;
        peakDay = from + i;
      }
    }
    result.set(productId, { unitDays, peakUnits, peakDay });
  }
  return result;
}

/** % de eventos por día de la semana, de lunes a domingo (suma 100 si hay eventos). */
export function weekdayShare(eventDays: number[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const day of eventDays) {
    // El 1/1/1970 (día 0) fue jueves: (day + 3) % 7 → 0 = lunes.
    counts[(((day + 3) % 7) + 7) % 7] += 1;
  }
  const total = eventDays.length;
  return counts.map((c) => (total ? (c / total) * 100 : 0));
}

export const ANTICIPATION_BUCKETS = [
  { label: 'Menos de 7 días', max: 6 },
  { label: '7 a 14 días', max: 14 },
  { label: '15 a 30 días', max: 30 },
  { label: '1 a 2 meses', max: 60 },
  { label: 'Más de 2 meses', max: Infinity },
] as const;

/**
 * Con cuántos días de anticipación se cargó cada alquiler respecto de su
 * evento, agrupado. Una carga posterior al evento (retroactiva) cuenta como
 * "menos de 7 días" en vez de dar días negativos.
 */
export function anticipationShare(
  pairs: { createdDay: number; eventDay: number }[],
): { label: string; pct: number; count: number }[] {
  const counts = ANTICIPATION_BUCKETS.map(() => 0);
  for (const { createdDay, eventDay } of pairs) {
    const days = Math.max(0, eventDay - createdDay);
    const i = ANTICIPATION_BUCKETS.findIndex((b) => days <= b.max);
    counts[i] += 1;
  }
  return ANTICIPATION_BUCKETS.map((b, i) => ({
    label: b.label,
    count: counts[i],
    pct: pairs.length ? (counts[i] / pairs.length) * 100 : 0,
  }));
}

/**
 * Identifica a un cliente entre alquileres: por teléfono (últimos 9 dígitos,
 * así "0981 123 456" y "+595 981 123456" son el mismo) o, si no tiene, por
 * nombre sin tildes ni mayúsculas. null si no hay con qué identificarlo.
 */
export function clientKey(
  name: string | null | undefined,
  phone: string | null | undefined,
): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length >= 6) return `t:${digits.slice(-9)}`;
  const n = (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return n ? `n:${n}` : null;
}

/**
 * De los clientes con algún evento en [from, to], cuántos ya habían tenido un
 * evento ANTES de su primer evento del período ("clientes que repiten").
 * `history` son todos los alquileres concretados (no presupuestos ni anulados).
 */
export function repeatClients(
  history: { key: string | null; eventDay: number }[],
  from: number,
  to: number,
): { clientes: number; repiten: number } {
  const firstInPeriod = new Map<string, number>();
  for (const h of history) {
    if (!h.key || h.eventDay < from || h.eventDay > to) continue;
    const prev = firstInPeriod.get(h.key);
    if (prev === undefined || h.eventDay < prev)
      firstInPeriod.set(h.key, h.eventDay);
  }
  const before = new Set<string>();
  for (const h of history) {
    if (!h.key) continue;
    const first = firstInPeriod.get(h.key);
    if (first !== undefined && h.eventDay < first) before.add(h.key);
  }
  return { clientes: firstInPeriod.size, repiten: before.size };
}

export type ProductSuggestion =
  | 'comprar_mas'
  | 'sin_movimiento'
  | 'sobra_stock'
  | null;

/**
 * Sugerencia para el dueño según cómo se usó el producto en el período:
 * - comprar_mas: algún día salió el 90 % o más del stock (se llegó al límite).
 * - sin_movimiento: tiene stock y no salió nunca.
 * - sobra_stock: salió, pero ni el día de más demanda llegó al 15 % del stock
 *   (sobran unidades). No se mira la ocupación promedio: en alquileres para
 *   eventos el stock pasa guardado la mayoría de los días y casi todo daría "bajo".
 */
export function suggestion(
  stock: number,
  occupancyPct: number,
  peakPct: number,
  timesRented: number,
): ProductSuggestion {
  if (stock <= 0) return null;
  if (peakPct >= 90) return 'comprar_mas';
  if (timesRented === 0 && occupancyPct === 0) return 'sin_movimiento';
  if (peakPct < 15) return 'sobra_stock';
  return null;
}
