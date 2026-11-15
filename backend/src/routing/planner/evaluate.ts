import { Ctx } from './context';
import { PlannedRoute, PlannedStop } from './types';

/** Resultado de recorrer una ruta en orden. Se reutiliza el mismo objeto para no generar basura en el bucle caliente. */
export interface RouteMetrics {
  /** Función objetivo de esta ruta: duración + lateWeight × atraso. */
  cost: number;
  /** De la salida del depósito al fin (incluye viaje, espera y atención). */
  duration: number;
  travel: number;
  late: number;
}

export function newMetrics(): RouteMetrics {
  return { cost: 0, duration: 0, travel: 0, late: 0 };
}

/**
 * Recorre la ruta (lista de índices de parada) desde el depósito y calcula su
 * costo. Es LA definición del objetivo: todo lo demás (heurística, exactos,
 * resultado) usa esta función, así no pueden contradecirse.
 *
 *   costo = (fin − salida) + lateWeight × atraso total
 *
 * La duración incluye la atención (constante: todas las paradas se atienden
 * igual en cualquier orden) y las esperas por llegar antes de la ventana.
 * Una ruta vacía no sale del depósito y cuesta 0.
 */
export function evalRoute(
  ctx: Ctx,
  seq: readonly number[],
  out: RouteMetrics,
): RouteMetrics {
  if (seq.length === 0) {
    out.cost = out.duration = out.travel = out.late = 0;
    return out;
  }
  const { travel, size, node, service, from, to } = ctx;
  let t = ctx.startSec;
  let prev = 0;
  let travelSum = 0;
  let late = 0;
  for (let k = 0; k < seq.length; k++) {
    const s = seq[k];
    const nd = node[s];
    const leg = travel[prev * size + nd];
    travelSum += leg;
    let start = t + leg;
    if (start < from[s]) start = from[s];
    else if (start > to[s]) late += start - to[s];
    t = start + service[s];
    prev = nd;
  }
  if (ctx.returnToDepot) {
    const back = travel[prev * size + 0];
    travelSum += back;
    t += back;
  }
  out.travel = travelSum;
  out.late = late;
  out.duration = t - ctx.startSec;
  out.cost = out.duration + ctx.lateWeight * late;
  return out;
}

/** Costo total de una solución: suma de rutas + peso del que termina último. */
export function totalCost(
  ctx: Ctx,
  costs: readonly number[],
  durations: readonly number[],
): number {
  let sum = 0;
  let maxDur = 0;
  for (let r = 0; r < costs.length; r++) {
    sum += costs[r];
    if (durations[r] > maxDur) maxDur = durations[r];
  }
  return sum + ctx.makespanWeight * maxDur;
}

/** Cálculo completo de una ruta para mostrar: horarios, esperas, atrasos y kilómetros de cada tramo. */
export function describeRoute(
  ctx: Ctx,
  seq: readonly number[],
  stopIds: readonly string[],
  vehicle: number,
): PlannedRoute {
  const { travel, dist, size, node, service, from, to } = ctx;
  const stops: PlannedStop[] = [];
  let t = ctx.startSec;
  let prev = 0;
  let travelSec = 0;
  let distanceM = 0;
  let serviceSec = 0;
  let waitSec = 0;
  let lateSec = 0;
  for (const s of seq) {
    const nd = node[s];
    const legSec = travel[prev * size + nd];
    const legM = dist[prev * size + nd];
    const arrive = t + legSec;
    let start = arrive;
    let wait = 0;
    let late = 0;
    if (arrive < from[s]) {
      wait = from[s] - arrive;
      start = from[s];
    } else if (arrive > to[s]) {
      late = arrive - to[s];
    }
    const depart = start + service[s];
    stops.push({
      id: stopIds[s],
      arriveSec: arrive,
      startSec: start,
      departSec: depart,
      waitSec: wait,
      lateSec: late,
      legSec,
      legM,
    });
    travelSec += legSec;
    distanceM += legM;
    serviceSec += service[s];
    waitSec += wait;
    lateSec += late;
    t = depart;
    prev = nd;
  }
  if (ctx.returnToDepot && seq.length > 0) {
    const back = travel[prev * size + 0];
    travelSec += back;
    distanceM += dist[prev * size + 0];
    t += back;
  }
  return {
    vehicle,
    stops,
    travelSec,
    distanceM,
    serviceSec,
    waitSec,
    lateSec,
    endSec: t,
    durationSec: seq.length === 0 ? 0 : t - ctx.startSec,
  };
}
