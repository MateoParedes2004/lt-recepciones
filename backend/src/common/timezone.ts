// Paraguay no aplica horario de verano desde 2024: queda fijo en UTC-4 todo
// el año. Este es el único lugar del backend que debe saber ese dato —
// cualquier código que necesite razonar sobre "qué día es" en términos del
// negocio (no del reloj/huso horario del servidor, que en Render corre en
// UTC) pasa por estas funciones.
//
// Importante: esto es solo para marcas de tiempo REALES (cuándo pasó algo
// de verdad — una visita, un pedido por WhatsApp). Las fechas de calendario
// puras como Rental.eventDate/returnDate (elegidas en un <input type="date">
// y guardadas como medianoche UTC por convención) NO deben pasar por acá:
// ajustarlas por huso horario las correría de fecha. Esas se leen siempre
// con los getters UTC (getUTCFullYear/getUTCMonth/getUTCDate).
const PARAGUAY_OFFSET_HOURS = 4; // UTC-4

/** Instante UTC real que corresponde a una fecha/hora de pared en Paraguay. */
export function paraguayToUtc(
  year: number,
  month1to12: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day, hour + PARAGUAY_OFFSET_HOURS, minute, second, ms));
}

/** Año/mes/día calendario en Paraguay que corresponde a un instante UTC real. */
export function utcToParaguayDate(instant: Date): { year: number; month: number; day: number } {
  const shifted = new Date(instant.getTime() - PARAGUAY_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Medianoche de "hoy" en Paraguay, como instante UTC real. */
export function paraguayTodayUtc(now: Date = new Date()): Date {
  const { year, month, day } = utcToParaguayDate(now);
  return paraguayToUtc(year, month, day);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Número de día (días desde 1970-01-01) de una fecha de calendario pura
 * (medianoche UTC, como Rental.eventDate/returnDate). Permite comparar y
 * restar fechas de calendario sin preocuparse por horas.
 */
export function toDayIndex(calendarDate: Date): number {
  return Math.floor(calendarDate.getTime() / MS_PER_DAY);
}

/** Inversa de toDayIndex: la fecha de calendario (medianoche UTC) de un número de día. */
export function fromDayIndex(dayIndex: number): Date {
  return new Date(dayIndex * MS_PER_DAY);
}

/**
 * "Hoy" en Paraguay como fecha de calendario pura (medianoche UTC del día que
 * marca el calendario de Paraguay), para compararla con eventDate/returnDate.
 * No es lo mismo que paraguayTodayUtc(), que es un instante real (04:00 UTC).
 */
export function paraguayTodayIndex(now: Date = new Date()): number {
  const { year, month, day } = utcToParaguayDate(now);
  return toDayIndex(new Date(Date.UTC(year, month - 1, day)));
}

/** dd/mm/aaaa de un número de día, para mensajes de error legibles. */
export function formatDayIndex(dayIndex: number): string {
  const d = fromDayIndex(dayIndex);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}
