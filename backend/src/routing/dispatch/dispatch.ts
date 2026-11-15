import { DEPOT, GeoPoint } from '../geo';

/**
 * Piezas puras del reparto (sin base de datos ni red): conversión de horas,
 * tiempos de atención y links de Google Maps. Están aparte del servicio para
 * probarlas sin armar nada.
 */

export type StopKind = 'ENTREGA' | 'RETIRO';

export const DEFAULT_START_TIME = '08:00';
export const DEFAULT_VEHICLES = 1;
export const MAX_VEHICLES = 3;
/**
 * Multiplicador de los tiempos de viaje por tráfico. Los tiempos de Geoapify
 * son "sin tráfico"; 1,3 es un punto de partida prudente para Gran Asunción
 * que se puede ajustar en cada plan. No está calibrado: la idea es calibrarlo
 * con las horas reales que se guardan en cada parada.
 */
export const DEFAULT_TRAFFIC_FACTOR = 1.3;
export const MIN_TRAFFIC_FACTOR = 1;
export const MAX_TRAFFIC_FACTOR = 3;
/** Un solo pedido de matriz admite hasta 31 puntos (el depósito + 30 paradas). */
export const MAX_STOPS_PER_PLAN = 30;

const DAY_SEC = 24 * 3600;

/** "09:30" → 34200 (segundos desde la medianoche). Lanza un error si no es una hora válida. */
export function hhmmToSec(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error(`Hora inválida: "${hhmm}" (se espera HH:MM).`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60;
}

/** Segundos desde la medianoche → "HH:MM". Pasada la medianoche vuelve a empezar (el día siguiente). */
export function secToHhmm(sec: number): string {
  const total = Math.round(sec / 60);
  const minutes = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** ¿El instante cae después de la medianoche del día del plan? (el plan se pasó al día siguiente). */
export function isNextDay(sec: number): boolean {
  return sec >= DAY_SEC;
}

/**
 * Ventana horaria de una parada a partir de los dos extremos que cargó el
 * admin. Con un solo extremo, el otro queda abierto (sin límite).
 */
export function windowFromHhmm(
  from: string | null | undefined,
  to: string | null | undefined,
): { fromSec: number; toSec: number } | undefined {
  if (!from && !to) return undefined;
  return {
    fromSec: from ? hhmmToSec(from) : 0,
    // Sin extremo final: abierto hasta el fin de ese día (23:59:59).
    toSec: to ? hhmmToSec(to) : DAY_SEC - 1,
  };
}

/**
 * Cuánto tiempo se queda el camión en cada parada, según cuántas unidades
 * mueve. Son valores de partida (descargar y armar toma más que desarmar y
 * cargar), pensados para ajustarlos con las horas reales de cada parada.
 */
const SERVICE_MODEL: Record<
  StopKind,
  { baseMin: number; unitsPerMin: number; capMin: number }
> = {
  ENTREGA: { baseMin: 15, unitsPerMin: 20, capMin: 60 },
  RETIRO: { baseMin: 10, unitsPerMin: 25, capMin: 45 },
};

export function serviceMinutes(kind: StopKind, units: number): number {
  const m = SERVICE_MODEL[kind];
  const extra = Math.ceil(Math.max(0, units) / m.unitsPerMin);
  return Math.min(m.capMin, m.baseMin + extra);
}

// ------------------------------------------------------------------ links de Google Maps

const coord = (p: GeoPoint): string =>
  `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** El punto marcado en el mapa. */
export function mapsPointUrl(p: GeoPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${coord(p)}`;
}

/** Indicaciones para llegar manejando (desde donde esté el celular). */
export function mapsDirectionsUrl(p: GeoPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coord(p)}&travelmode=driving`;
}

/** Google Maps admite hasta 9 paradas intermedias por link. */
const MAPS_MAX_WAYPOINTS = 9;

/**
 * Links de Google Maps con TODO el recorrido en orden (salida del depósito,
 * paradas y, si corresponde, vuelta). Si tiene más paradas de las que admite
 * un link, lo parte en tramos consecutivos: cada uno arranca donde terminó el
 * anterior.
 */
export function mapsRouteUrls(
  stops: GeoPoint[],
  returnToDepot = true,
  depot: GeoPoint = DEPOT,
): string[] {
  const path = returnToDepot ? [...stops, depot] : [...stops];
  if (path.length === 0) return [];
  const urls: string[] = [];
  let origin: GeoPoint = depot;
  for (let i = 0; i < path.length; i += MAPS_MAX_WAYPOINTS + 1) {
    const chunk = path.slice(i, i + MAPS_MAX_WAYPOINTS + 1);
    const destination = chunk[chunk.length - 1];
    const waypoints = chunk.slice(0, -1);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${coord(origin)}&destination=${coord(destination)}&travelmode=driving`;
    if (waypoints.length > 0) {
      url += `&waypoints=${waypoints.map(coord).join('%7C')}`; // %7C = "|"
    }
    urls.push(url);
    origin = destination;
  }
  return urls;
}
