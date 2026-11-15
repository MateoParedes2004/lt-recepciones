import { Ctx } from './context';
import { evalRoute, newMetrics, totalCost } from './evaluate';

/**
 * Solvers EXACTOS para problemas chicos. Sirven para dos cosas:
 *  - dar un certificado de optimalidad ("este plan es el mejor posible"), y
 *  - ser el oráculo contra el que se prueba la heurística.
 */

/** Hasta cuántas paradas resuelve Held-Karp (1 camión, sin ventanas). 15 → ~4 MB y milisegundos. */
export const HELD_KARP_MAX_STOPS = 15;
/** Hasta cuántas paradas intenta la ramificación y poda (1 camión, con ventanas). */
export const BRANCH_BOUND_MAX_STOPS = 10;
/** Tope de nodos explorados por la ramificación y poda: si se pasa, se abandona (no se promete optimalidad). */
export const BRANCH_BOUND_NODE_CAP = 1_500_000;
/** La enumeración completa se usa si (paradas + camiones − 1) no pasa de este número (8! = 40.320 órdenes). */
export const ENUMERATION_MAX_ITEMS = 8;

/** ¿Se puede garantizar el óptimo con Held-Karp? Un camión, sin ventanas, pocas paradas. */
export function canHeldKarp(ctx: Ctx): boolean {
  return (
    ctx.vehicles === 1 &&
    !ctx.hasWindows &&
    ctx.n >= 1 &&
    ctx.n <= HELD_KARP_MAX_STOPS
  );
}

/**
 * Programación dinámica de Held-Karp: el mejor orden para visitar todas las
 * paradas con un camión. Sin ventanas horarias, minimizar el costo es
 * minimizar el tiempo de viaje (la atención dura lo mismo en cualquier orden).
 */
export function solveHeldKarp(ctx: Ctx): number[] {
  const n = ctx.n;
  const { travel, size, node } = ctx;
  const full = (1 << n) - 1;
  const INF = Number.POSITIVE_INFINITY;
  const dp = new Float64Array((1 << n) * n).fill(INF);
  const parent = new Int8Array((1 << n) * n).fill(-1);
  for (let j = 0; j < n; j++) dp[(1 << j) * n + j] = travel[0 * size + node[j]];
  for (let mask = 1; mask <= full; mask++) {
    for (let j = 0; j < n; j++) {
      if (!(mask & (1 << j))) continue;
      const cur = dp[mask * n + j];
      if (cur === INF) continue;
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue;
        const next = mask | (1 << k);
        const v = cur + travel[node[j] * size + node[k]];
        if (v < dp[next * n + k]) {
          dp[next * n + k] = v;
          parent[next * n + k] = j;
        }
      }
    }
  }
  let best = INF;
  let last = 0;
  for (let j = 0; j < n; j++) {
    const v =
      dp[full * n + j] + (ctx.returnToDepot ? travel[node[j] * size + 0] : 0);
    if (v < best) {
      best = v;
      last = j;
    }
  }
  const order: number[] = [];
  let mask = full;
  let j = last;
  while (j !== -1) {
    order.push(j);
    const p = parent[mask * n + j];
    mask ^= 1 << j;
    j = p;
  }
  return order.reverse();
}

export interface BranchBoundResult {
  /** Mejor orden hallado que SUPERA al incumbente (null si el incumbente ya era óptimo o no se encontró nada mejor). */
  order: number[] | null;
  cost: number;
  /** true si recorrió todo el árbol: entonces el resultado (o el incumbente) es el óptimo demostrado. */
  complete: boolean;
}

/**
 * Ramificación y poda para UN camión (admite ventanas horarias). `incumbent`
 * es el costo de la mejor solución conocida (la de la heurística): solo
 * interesa lo que la mejore.
 */
export function solveBranchAndBound(
  ctx: Ctx,
  incumbent: number,
): BranchBoundResult {
  const n = ctx.n;
  const { travel, size, node, service, from, to } = ctx;
  const w = 1 + ctx.makespanWeight;
  let best = incumbent;
  let bestOrder: number[] | null = null;
  let nodes = 0;
  let complete = true;
  const used = new Array<boolean>(n).fill(false);
  const seq: number[] = [];

  const dfs = (t: number, prev: number, late: number): void => {
    if (!complete) return;
    if (++nodes > BRANCH_BOUND_NODE_CAP) {
      complete = false;
      return;
    }
    if (seq.length === n) {
      let end = t;
      if (ctx.returnToDepot) end += travel[prev * size + 0];
      const total = w * (end - ctx.startSec) + ctx.lateWeight * late;
      if (total < best - 1e-6) {
        best = total;
        bestOrder = seq.slice();
      }
      return;
    }
    // Candidatas ordenadas por tiempo de viaje: las buenas primero, para podar antes.
    const options: { s: number; leg: number }[] = [];
    for (let s = 0; s < n; s++)
      if (!used[s]) options.push({ s, leg: travel[prev * size + node[s]] });
    options.sort((a, b) => a.leg - b.leg);
    for (const { s, leg } of options) {
      let start = t + leg;
      let newLate = late;
      if (start < from[s]) start = from[s];
      else if (start > to[s]) newLate += start - to[s];
      const nt = start + service[s];
      // Cota inferior: lo ya gastado (sin el viaje de vuelta, que solo suma).
      if (w * (nt - ctx.startSec) + ctx.lateWeight * newLate >= best - 1e-6)
        continue;
      used[s] = true;
      seq.push(s);
      dfs(nt, node[s], newLate);
      seq.pop();
      used[s] = false;
      if (!complete) return;
    }
  };
  dfs(ctx.startSec, 0, 0);
  return { order: bestOrder, cost: best, complete };
}

export interface EnumerationResult {
  routes: number[][];
  total: number;
}

/** ¿Alcanza la enumeración completa (todas las rutas posibles) para este problema? */
export function canEnumerate(ctx: Ctx): boolean {
  return ctx.n >= 1 && ctx.n + ctx.vehicles - 1 <= ENUMERATION_MAX_ITEMS;
}

/**
 * Prueba TODAS las formas de repartir y ordenar las paradas entre los camiones.
 * Los camiones se separan con "divisores" dentro de una única permutación.
 */
export function solveEnumeration(ctx: Ctx): EnumerationResult {
  const items = ctx.n + ctx.vehicles - 1; // las paradas son 0..n-1; los divisores, n..items-1
  const perm = Array.from({ length: items }, (_, i) => i);
  const scratch = newMetrics();
  let best = Infinity;
  let bestRoutes: number[][] = [];

  const evaluate = (): void => {
    const routes: number[][] = [[]];
    for (const x of perm) {
      if (x >= ctx.n) routes.push([]);
      else routes[routes.length - 1].push(x);
    }
    const costs: number[] = [];
    const durs: number[] = [];
    for (const r of routes) {
      evalRoute(ctx, r, scratch);
      costs.push(scratch.cost);
      durs.push(scratch.duration);
    }
    const total = totalCost(ctx, costs, durs);
    if (total < best - 1e-9) {
      best = total;
      bestRoutes = routes.map((r) => r.slice());
    }
  };

  // Permutaciones por intercambios recursivos.
  const permute = (k: number): void => {
    if (k === items) {
      evaluate();
      return;
    }
    for (let i = k; i < items; i++) {
      [perm[k], perm[i]] = [perm[i], perm[k]];
      permute(k + 1);
      [perm[k], perm[i]] = [perm[i], perm[k]];
    }
  };
  permute(0);
  while (bestRoutes.length < ctx.vehicles) bestRoutes.push([]);
  return { routes: bestRoutes, total: best };
}
