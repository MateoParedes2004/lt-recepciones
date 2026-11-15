import { buildCtx, Ctx } from './context';
import { describeRoute, evalRoute, newMetrics, totalCost } from './evaluate';
import {
  BRANCH_BOUND_MAX_STOPS,
  canEnumerate,
  canHeldKarp,
  solveBranchAndBound,
  solveEnumeration,
  solveHeldKarp,
} from './exact';
import { cloneSolution, evaluateAll, makeRng, runIls, Solution } from './ils';
import { PlannedRoute, PlannerProblem, PlanResult } from './types';

export const DEFAULT_SEED = 20261115;
export const DEFAULT_TIME_BUDGET_MS = 800;
export const DEFAULT_MAX_ITERATIONS = 40_000;
const DEFAULT_RESTARTS = 3;
/** No vale la pena arrancar otra búsqueda con menos tiempo que este. */
const MIN_RESTART_MS = 40;
const RESTART_SEED_STEP = 7919;

const now = (): number => performance.now();

/**
 * Arma el mejor plan de entregas y retiros que encuentre:
 *  1. búsqueda heurística (construcción + mejora local + destruir/reconstruir);
 *  2. si el problema es chico, un solver exacto que confirma que es el óptimo
 *     (o lo mejora, si la heurística se quedó corta).
 * Es determinista: el mismo problema y la misma semilla dan el mismo plan.
 */
export function solve(problem: PlannerProblem): PlanResult {
  const startedAt = now();
  const ctx = buildCtx(problem);
  const ids = problem.stops.map((s) => s.id);
  const opts = problem.options ?? {};

  if (ctx.n === 0)
    return assemble(
      ctx,
      ids,
      evaluateAll(ctx, []),
      'exact',
      true,
      0,
      startedAt,
    );

  // Varias búsquedas independientes (semillas distintas) repartiéndose el tiempo:
  // una sola puede quedar atrapada en un óptimo local profundo; con varias, la
  // mejor se queda. Con pocas paradas una alcanza.
  // Si después un solver exacto va a verificar o corregir el resultado, una
  // sola búsqueda alcanza: reiniciar solo gastaría tiempo.
  const exactWillRun =
    !opts.skipExact &&
    (canHeldKarp(ctx) ||
      canEnumerate(ctx) ||
      (ctx.vehicles === 1 && ctx.n <= BRANCH_BOUND_MAX_STOPS));
  const restarts = Math.max(
    1,
    Math.floor(opts.restarts ?? (exactWillRun ? 1 : DEFAULT_RESTARTS)),
  );
  const seed = opts.seed ?? DEFAULT_SEED;
  const budgetMs = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const deadline = startedAt + budgetMs;
  let best: Solution | null = null;
  let iterations = 0;
  for (let k = 0; k < restarts; k++) {
    const remainingMs = deadline - now();
    if (k > 0 && remainingMs < MIN_RESTART_MS) break;
    const run = runIls(ctx, makeRng(seed + k * RESTART_SEED_STEP), {
      timeBudgetMs: Math.max(1, remainingMs / (restarts - k)),
      maxIterations: Math.max(1, Math.floor(maxIterations / restarts)),
      stagnationLimit: opts.stagnationLimit,
      now,
    });
    iterations += run.iterations;
    if (!best || run.best.total < best.total - 1e-6) best = run.best;
  }

  let solution: Solution = best!;
  let optimal = false;
  if (!opts.skipExact) {
    const exact = tryExact(ctx, solution);
    if (exact) {
      solution = exact.solution;
      optimal = exact.optimal;
    }
  }
  return assemble(
    ctx,
    ids,
    solution,
    optimal ? 'exact' : 'heuristic',
    optimal,
    iterations,
    startedAt,
  );
}

/** Verificación exacta cuando el tamaño lo permite. Devuelve null si el problema es muy grande para probar el óptimo. */
function tryExact(
  ctx: Ctx,
  heuristic: Solution,
): { solution: Solution; optimal: boolean } | null {
  const EPS = 1e-6;
  if (canHeldKarp(ctx)) {
    const order = solveHeldKarp(ctx);
    const candidate = evaluateAll(ctx, [order]);
    return {
      solution: candidate.total < heuristic.total - EPS ? candidate : heuristic,
      optimal: true,
    };
  }
  if (canEnumerate(ctx)) {
    const result = solveEnumeration(ctx);
    const candidate = evaluateAll(ctx, result.routes);
    return {
      solution: candidate.total < heuristic.total - EPS ? candidate : heuristic,
      optimal: true,
    };
  }
  if (ctx.vehicles === 1 && ctx.n <= BRANCH_BOUND_MAX_STOPS) {
    const result = solveBranchAndBound(ctx, heuristic.total);
    if (!result.complete) return null;
    if (result.order)
      return { solution: evaluateAll(ctx, [result.order]), optimal: true };
    return { solution: heuristic, optimal: true };
  }
  return null;
}

function assemble(
  ctx: Ctx,
  ids: string[],
  sol: Solution,
  method: 'exact' | 'heuristic',
  optimal: boolean,
  iterations: number,
  startedAt: number,
): PlanResult {
  // Se recalcula todo desde las rutas finales con la misma función objetivo (nada arrastrado de la búsqueda).
  const final = cloneSolution(evaluateAll(ctx, sol.routes));
  const routes: PlannedRoute[] = [];
  final.routes.forEach((seq, i) => {
    if (seq.length > 0) routes.push(describeRoute(ctx, seq, ids, i + 1));
  });
  // Los camiones se numeran 1, 2, ... en el orden en que quedan, sin huecos.
  routes.forEach((r, i) => (r.vehicle = i + 1));

  const totals = routes.reduce(
    (acc, r) => ({
      stops: acc.stops + r.stops.length,
      travelSec: acc.travelSec + r.travelSec,
      distanceM: acc.distanceM + r.distanceM,
      serviceSec: acc.serviceSec + r.serviceSec,
      waitSec: acc.waitSec + r.waitSec,
      lateSec: acc.lateSec + r.lateSec,
      finishSec: Math.max(acc.finishSec, r.endSec),
    }),
    {
      stops: 0,
      travelSec: 0,
      distanceM: 0,
      serviceSec: 0,
      waitSec: 0,
      lateSec: 0,
      finishSec: ctx.startSec,
    },
  );
  return {
    routes,
    totals,
    cost: final.total,
    method,
    optimal,
    iterations,
    elapsedMs: now() - startedAt,
  };
}

/** Costo de un plan con la función objetivo del optimizador (para comparar planes de distintos orígenes). */
export function costOfRoutes(
  problem: PlannerProblem,
  routes: number[][],
): number {
  const ctx = buildCtx(problem);
  const m = newMetrics();
  const costs: number[] = [];
  const durs: number[] = [];
  for (const r of routes) {
    evalRoute(ctx, r, m);
    costs.push(m.cost);
    durs.push(m.duration);
  }
  return totalCost(ctx, costs, durs);
}
