// Cálculos de la pantalla Inicio del panel. Funciones puras (sin React ni
// red): reciben los alquileres y productos que el panel ya cargó.
//
// Fechas: eventDate/returnDate son fechas de CALENDARIO (medianoche UTC) y se
// manejan como "número de día" (días desde 1970-01-01), igual que el backend.
// Los criterios son los mismos que Estadísticas y AvailabilityService:
// - Ingresos: alquileres cuyo EVENTO cae en el período, sin presupuestos ni anulados.
// - Ocupación: un alquiler ACTIVO ocupa del día del evento al de devolución,
//   ambos inclusive; si está atrasado, hasta hoy. Los DEVUELTO, hasta su devolución.

import type { CheckoutIntent, Product, Rental } from "../types";

export const DAY_MS = 86_400_000;
/** Paraguay está en UTC-3 todo el año (desde octubre de 2024). */
const PARAGUAY_OFFSET_MS = 3 * 60 * 60 * 1000;

/** "Hoy" en Paraguay como número de día. */
export function paraguayTodayIdx(now: number = Date.now()): number {
  return Math.floor((now - PARAGUAY_OFFSET_MS) / DAY_MS);
}

/** "2026-11-20T00:00:00.000Z" (o "2026-11-20") → número de día. */
export function dayOf(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

/** Número de día → "2026-11-20". */
export function isoOfDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Año y mes (1-12) de un número de día. */
export function ymOfDay(day: number): { year: number; month: number; date: number } {
  const d = new Date(day * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, date: d.getUTCDate() };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function firstDayOfMonth(year: number, month: number): number {
  return Math.floor(Date.UTC(year, month - 1, 1) / DAY_MS);
}

/** Mes anterior a (year, month). */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** Se concretó (o se va a concretar): cuenta para ingresos. */
export function countsAsIncome(r: Rental): boolean {
  return r.status !== "CANCELADO" && r.status !== "PRESUPUESTO";
}

function inMonth(r: Rental, year: number, month: number): boolean {
  const { year: y, month: m } = ymOfDay(dayOf(r.eventDate));
  return y === year && m === month;
}

/** Ingresos de un mes (todos los eventos del mes, ya pasados o por venir). */
export function monthIncome(rentals: Rental[], year: number, month: number): number {
  return rentals.reduce((acc, r) => (countsAsIncome(r) && inMonth(r, year, month) ? acc + (Number(r.totalPrice) || 0) : acc), 0);
}

/**
 * Ingresos que ese mes TENÍA cargados en un momento dado (cutoff, ms): los
 * alquileres creados hasta ese momento que hoy siguen vigentes, más los que se
 * anularon DESPUÉS (en ese momento todavía contaban). Sirve para comparar el
 * mes en curso con el anterior "a la misma altura" y no contra el mes completo.
 */
export function monthIncomeAsOf(rentals: Rental[], year: number, month: number, cutoff: number): number {
  return rentals.reduce((acc, r) => {
    if (!inMonth(r, year, month) || Date.parse(r.createdAt) > cutoff) return acc;
    const vigente =
      countsAsIncome(r) || (r.status === "CANCELADO" && r.cancelledAt != null && Date.parse(r.cancelledAt) > cutoff);
    return vigente ? acc + (Number(r.totalPrice) || 0) : acc;
  }, 0);
}

/**
 * Comparación del mes en curso contra el anterior a la misma altura: lo que
 * el mes pasado tenía cargado al final del mismo día del mes (en Paraguay).
 */
export function incomeVsLastMonth(rentals: Rental[], today: number) {
  const { year, month, date } = ymOfDay(today);
  const prev = prevMonth(year, month);
  const prevDate = Math.min(date, daysInMonth(prev.year, prev.month));
  // Fin del día prevDate en Paraguay = medianoche del día siguiente + 3 h (UTC).
  const cutoff = Date.UTC(prev.year, prev.month - 1, prevDate + 1) + PARAGUAY_OFFSET_MS - 1;
  const current = monthIncome(rentals, year, month);
  const previous = monthIncomeAsOf(rentals, prev.year, prev.month, cutoff);
  return {
    current,
    previous,
    prevMonth: prev.month,
    prevDate,
    pct: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

/** Alquileres confirmados con evento desde mañana en adelante. */
export function futureBooked(rentals: Rental[], today: number): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const r of rentals) {
    if (r.status === "ACTIVO" && dayOf(r.eventDate) > today) {
      total += Number(r.totalPrice) || 0;
      count += 1;
    }
  }
  return { total, count };
}

/** "60 Sillas Tiffany · 8 Mesas redondas · +2 más" */
export function itemsSummary(r: Rental, max = 2): string {
  const items = [...(r.items ?? [])].sort((a, b) => b.quantity - a.quantity);
  const parts = items.slice(0, max).map((i) => `${i.quantity} ${i.product?.name ?? "producto"}`);
  if (items.length > max) parts.push(`+${items.length - max} más`);
  return parts.join(" · ") || "Sin productos";
}

export type StopKind = "ENTREGA" | "RETIRO";

export interface AgendaStop {
  key: string;
  kind: StopKind;
  rental: Rental;
  /** "09:00–11:00", "desde 09:00", "hasta 11:00" o null si no tiene horario. */
  window: string | null;
  /** Para ordenar: minutos desde las 00:00 del inicio del horario (sin horario, al final). */
  sortMin: number;
}

function windowText(from?: string | null, to?: string | null): string | null {
  if (from && to) return `${from}–${to}`;
  if (from) return `desde ${from}`;
  if (to) return `hasta ${to}`;
  return null;
}

function toMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * Entregas (evento ese día) y retiros (devolución ese día) de los alquileres
 * ACTIVO, ordenados por horario. Mismo criterio que el planificador de rutas.
 */
export function stopsForDay(rentals: Rental[], day: number): AgendaStop[] {
  const stops: AgendaStop[] = [];
  for (const r of rentals) {
    if (r.status !== "ACTIVO") continue;
    if (dayOf(r.eventDate) === day) {
      stops.push({
        key: `ENTREGA-${r.id}`,
        kind: "ENTREGA",
        rental: r,
        window: windowText(r.deliveryWindowFrom, r.deliveryWindowTo),
        sortMin: toMin(r.deliveryWindowFrom) ?? toMin(r.deliveryWindowTo) ?? 24 * 60,
      });
    }
    if (dayOf(r.returnDate) === day) {
      stops.push({
        key: `RETIRO-${r.id}`,
        kind: "RETIRO",
        rental: r,
        window: windowText(r.pickupWindowFrom, r.pickupWindowTo),
        sortMin: toMin(r.pickupWindowFrom) ?? toMin(r.pickupWindowTo) ?? 24 * 60,
      });
    }
  }
  return stops.sort((a, b) => a.sortMin - b.sortMin || a.rental.clientName.localeCompare(b.rental.clientName));
}

/**
 * Unidades afuera por producto y por día en [start, start + days).
 * Devuelve, para cada producto con movimiento, un arreglo de `days` números.
 */
export function unitsOutByDay(rentals: Rental[], start: number, days: number, today: number): Map<number, number[]> {
  const deltas = new Map<number, number[]>();
  const end = start + days - 1;
  for (const r of rentals) {
    if (r.status !== "ACTIVO" && r.status !== "DEVUELTO") continue;
    const ret = dayOf(r.returnDate);
    const last = r.status === "ACTIVO" ? Math.max(ret, today) : ret;
    const a = Math.max(dayOf(r.eventDate), start);
    const b = Math.min(last, end);
    if (b < a) continue;
    for (const item of r.items ?? []) {
      if (item.quantity <= 0) continue;
      let d = deltas.get(item.productId);
      if (!d) {
        d = new Array(days + 1).fill(0);
        deltas.set(item.productId, d);
      }
      d[a - start] += item.quantity;
      d[b - start + 1] -= item.quantity;
    }
  }
  const out = new Map<number, number[]>();
  for (const [id, d] of deltas) {
    let current = 0;
    out.set(
      id,
      d.slice(0, days).map((x) => (current += x)),
    );
  }
  return out;
}

export interface DayOccupancy {
  day: number;
  /** % reservado (0–100+, puede pasar de 100 si hay sobreventa). */
  pct: number;
  /** Producto más comprometido ese día (vista "todo el inventario"). */
  productName: string | null;
  units: number;
  stock: number;
}

/**
 * Ocupación día por día. Sin producto elegido: el % del producto MÁS
 * comprometido de cada día (el que limita si entra otro pedido grande); con
 * producto: el de ese producto.
 */
export function occupancyByDay(
  units: Map<number, number[]>,
  products: Product[],
  start: number,
  days: number,
  productId: number | null,
): DayOccupancy[] {
  const relevant = products.filter((p) => p.totalStock > 0 && (productId === null ? !p.isArchived : p.id === productId));
  return Array.from({ length: days }, (_, i) => {
    let best: DayOccupancy = { day: start + i, pct: 0, productName: null, units: 0, stock: 0 };
    for (const p of relevant) {
      const u = units.get(p.id)?.[i] ?? 0;
      const pct = (u / p.totalStock) * 100;
      if (pct > best.pct || (productId !== null && best.productName === null)) {
        best = { day: start + i, pct, productName: p.name, units: u, stock: p.totalStock };
      }
    }
    return best;
  });
}

/** Lunes de la semana de un día. */
export function mondayOf(day: number): number {
  // El día 0 (1/1/1970) fue jueves.
  return day - ((((day + 3) % 7) + 7) % 7);
}

/** Ingresos acumulados día por día de un mes (por fecha de evento). */
export function cumulativeByDay(rentals: Rental[], year: number, month: number): number[] {
  const n = daysInMonth(year, month);
  const daily = new Array(n).fill(0);
  for (const r of rentals) {
    if (!countsAsIncome(r) || !inMonth(r, year, month)) continue;
    daily[ymOfDay(dayOf(r.eventDate)).date - 1] += Number(r.totalPrice) || 0;
  }
  let acc = 0;
  return daily.map((v) => (acc += v));
}

/** El mes de mayor ingreso del año (null si no hubo ninguno). */
export function bestMonthOfYear(rentals: Rental[], year: number): { month: number; total: number } | null {
  let best: { month: number; total: number } | null = null;
  for (let m = 1; m <= 12; m++) {
    const total = monthIncome(rentals, year, m);
    if (total > 0 && (!best || total > best.total)) best = { month: m, total };
  }
  return best;
}

/** Productos que más se usaron en el mes: % de su capacidad (unidades × días). */
export function topUsedInMonth(rentals: Rental[], products: Product[], year: number, month: number, today: number, limit = 5) {
  const start = firstDayOfMonth(year, month);
  const n = daysInMonth(year, month);
  const units = unitsOutByDay(rentals, start, n, today);
  return products
    .filter((p) => p.totalStock > 0 && units.has(p.id))
    .map((p) => {
      const series = units.get(p.id) ?? [];
      const unitDays = series.reduce((a, b) => a + b, 0);
      return { id: p.id, name: p.name, pct: (unitDays / (p.totalStock * n)) * 100, peak: Math.max(0, ...series) };
    })
    .filter((p) => p.pct > 0)
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export type AlertTone = "rojo" | "ambar" | "azul";
export type AlertTarget = "rentals" | "routes" | "products";

export interface PanelAlert {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
  target: AlertTarget;
  /** Cliente o producto para abrir la pestaña ya filtrada. */
  search?: string;
}

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export function shortDate(day: number): string {
  const d = new Date(day * DAY_MS);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function namesList(names: string[], max = 2): string {
  const shown = names.slice(0, max).join(" · ");
  return names.length > max ? `${shown} y ${names.length - max} más` : shown;
}

/**
 * Lo que el dueño tiene que resolver: retiros atrasados, productos casi
 * agotados en las próximas 2 semanas, pedidos por WhatsApp sin confirmar,
 * presupuestos con el evento encima y entregas próximas sin ubicación.
 */
export function buildAlerts(
  rentals: Rental[],
  products: Product[],
  pendingOrders: CheckoutIntent[],
  today: number,
  now: number = Date.now(),
): PanelAlert[] {
  const alerts: PanelAlert[] = [];

  const overdue = rentals
    .filter((r) => r.phase === "ATRASADO")
    .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0));
  if (overdue.length) {
    alerts.push({
      id: "atrasados",
      tone: "rojo",
      title: `${overdue.length} ${plural(overdue.length, "retiro atrasado", "retiros atrasados")}`,
      detail: namesList(overdue.map((r) => `${r.clientName} (${r.daysOverdue ?? 0} ${plural(r.daysOverdue ?? 0, "día", "días")})`)),
      target: "rentals",
      search: overdue.length === 1 ? overdue[0].clientName : undefined,
    });
  }

  // Productos que algún día de las próximas 2 semanas quedan al 90 % o más.
  const horizon = 14;
  const units = unitsOutByDay(rentals, today, horizon, today);
  const tight = products
    .filter((p) => !p.isArchived && p.totalStock > 0)
    .map((p) => {
      const series = units.get(p.id) ?? [];
      let worst = -1;
      for (let i = 0; i < series.length; i++) if (worst < 0 || series[i] > series[worst]) worst = i;
      const used = worst >= 0 ? series[worst] : 0;
      return { p, day: today + Math.max(worst, 0), used, pct: (used / p.totalStock) * 100 };
    })
    .filter((x) => x.pct >= 90)
    .sort((a, b) => b.pct - a.pct || a.day - b.day);
  for (const x of tight.slice(0, 3)) {
    const free = Math.max(0, x.p.totalStock - x.used);
    alerts.push({
      id: `stock-${x.p.id}`,
      tone: "rojo",
      title: `${x.p.name}: ${Math.round(x.pct)}% el ${shortDate(x.day)}`,
      detail: x.used > x.p.totalStock
        ? `Faltan ${x.used - x.p.totalStock} ${plural(x.used - x.p.totalStock, "unidad", "unidades")}: hay más reservado que stock`
        : `${plural(free, "Queda", "Quedan")} ${free} ${plural(free, "libre", "libres")} de ${x.p.totalStock}`,
      target: "products",
      search: x.p.name,
    });
  }

  if (pendingOrders.length) {
    const oldest = oldestPending(pendingOrders);
    alerts.push({
      id: "whatsapp",
      tone: "ambar",
      title: `${pendingOrders.length} ${plural(pendingOrders.length, "pedido por WhatsApp sin confirmar", "pedidos por WhatsApp sin confirmar")}`,
      detail: oldest === null ? "Esperando respuesta" : `El más antiguo espera hace ${timeAgo(oldest, now)}`,
      target: "rentals",
    });
  }

  const quotes = rentals.filter((r) => {
    const d = dayOf(r.eventDate);
    return r.status === "PRESUPUESTO" && d >= today && d <= today + 7;
  });
  if (quotes.length) {
    alerts.push({
      id: "presupuestos",
      tone: "ambar",
      title: `${quotes.length} ${plural(quotes.length, "presupuesto", "presupuestos")} con el evento en menos de una semana`,
      detail: `Confirmalos o descartalos: ${namesList(quotes.map((r) => r.clientName))}`,
      target: "rentals",
      search: quotes.length === 1 ? quotes[0].clientName : undefined,
    });
  }

  // Entregas de los próximos 3 días con ciudad (o sea, con envío) pero sin la
  // ubicación exacta: no van a entrar en la ruta optimizada.
  const noPin = rentals.filter((r) => {
    const d = dayOf(r.eventDate);
    return r.status === "ACTIVO" && r.cityId != null && (r.deliveryLat == null || r.deliveryLng == null) && d >= today && d <= today + 3;
  });
  if (noPin.length) {
    alerts.push({
      id: "sin-ubicacion",
      tone: "azul",
      title: `${noPin.length} ${plural(noPin.length, "entrega próxima sin ubicación exacta", "entregas próximas sin ubicación exacta")}`,
      detail: `No entran en la ruta: ${namesList(noPin.map((r) => r.clientName))}`,
      target: "rentals",
      search: noPin.length === 1 ? noPin[0].clientName : undefined,
    });
  }

  return alerts;
}

/** Momento del pedido sin responder más antiguo (null si no hay ninguno con fecha válida). */
export function oldestPending(pendingOrders: CheckoutIntent[]): number | null {
  const times = pendingOrders.map((o) => Date.parse(o.createdAt)).filter(Number.isFinite);
  return times.length ? Math.min(...times) : null;
}

/** "5 h", "2 días", "15 min" */
export function timeAgo(then: number, now: number = Date.now()): string {
  if (!Number.isFinite(then) || !Number.isFinite(now)) return "un rato";
  const min = Math.max(0, Math.round((now - then) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} días`;
}

/** Gs. con puntos de miles. */
export function formatGs(amount: number): string {
  if (!Number.isFinite(amount)) amount = 0;
  return `Gs. ${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** "Gs. 22,4 M" / "Gs. 850 mil" para lugares chicos. */
export function formatGsShort(amount: number): string {
  if (!Number.isFinite(amount)) amount = 0;
  if (Math.abs(amount) >= 1_000_000) {
    return `Gs. ${(amount / 1_000_000).toLocaleString("es-PY", { maximumFractionDigits: 1 })} M`;
  }
  if (Math.abs(amount) >= 1_000) return `Gs. ${Math.round(amount / 1_000)} mil`;
  return formatGs(amount);
}

export const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
