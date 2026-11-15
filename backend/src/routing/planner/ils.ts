import { Ctx } from './context';
import { evalRoute, newMetrics, totalCost } from './evaluate';

const EPS = 1e-6;

// ---------------------------------------------------------------- azar repetible

export interface Rng {
  /** Número en [0, 1). */
  next(): number;
  /** Entero en [0, n). */
  int(n: number): number;
}

/** mulberry32: generador chico y rápido. Misma semilla, misma secuencia, en cualquier máquina. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------- solución

export interface Solution {
  /** Una lista de paradas por camión (puede quedar vacía). */
  routes: number[][];
  costs: number[];
  durs: number[];
  total: number;
}

export function evaluateAll(ctx: Ctx, routes: number[][]): Solution {
  const m = newMetrics();
  const costs: number[] = [];
  const durs: number[] = [];
  for (const r of routes) {
    evalRoute(ctx, r, m);
    costs.push(m.cost);
    durs.push(m.duration);
  }
  return { routes, costs, durs, total: totalCost(ctx, costs, durs) };
}

export function cloneSolution(s: Solution): Solution {
  return {
    routes: s.routes.map((r) => r.slice()),
    costs: s.costs.slice(),
    durs: s.durs.slice(),
    total: s.total,
  };
}

/**
 * Prueba cambiar una o dos rutas: si el total mejora, aplica el cambio y
 * devuelve true; si no, deja todo como estaba.
 */
function tryChange(
  ctx: Ctx,
  sol: Solution,
  scratch: ReturnType<typeof newMetrics>,
  a: number,
  na: number[],
  b = -1,
  nb: number[] | null = null,
): boolean {
  const oldCostA = sol.costs[a];
  const oldDurA = sol.durs[a];
  evalRoute(ctx, na, scratch);
  sol.costs[a] = scratch.cost;
  sol.durs[a] = scratch.duration;
  let oldCostB = 0;
  let oldDurB = 0;
  if (b >= 0 && nb) {
    oldCostB = sol.costs[b];
    oldDurB = sol.durs[b];
    evalRoute(ctx, nb, scratch);
    sol.costs[b] = scratch.cost;
    sol.durs[b] = scratch.duration;
  }
  const total = totalCost(ctx, sol.costs, sol.durs);
  if (total < sol.total - EPS) {
    sol.routes[a] = na;
    if (b >= 0 && nb) sol.routes[b] = nb;
    sol.total = total;
    return true;
  }
  sol.costs[a] = oldCostA;
  sol.durs[a] = oldDurA;
  if (b >= 0) {
    sol.costs[b] = oldCostB;
    sol.durs[b] = oldDurB;
  }
  return false;
}

// ---------------------------------------------------------------- construcción

/** Total de la solución si se agrega la parada `s` en la posición `pos` de la ruta `r` (sin modificarla). */
function insertionTotal(
  ctx: Ctx,
  sol: Solution,
  scratch: ReturnType<typeof newMetrics>,
  r: number,
  pos: number,
  s: number,
  tmp: number[],
): number {
  const route = sol.routes[r];
  tmp.length = 0;
  for (let i = 0; i < pos; i++) tmp.push(route[i]);
  tmp.push(s);
  for (let i = pos; i < route.length; i++) tmp.push(route[i]);
  evalRoute(ctx, tmp, scratch);
  const oldC = sol.costs[r];
  const oldD = sol.durs[r];
  sol.costs[r] = scratch.cost;
  sol.durs[r] = scratch.duration;
  const total = totalCost(ctx, sol.costs, sol.durs);
  sol.costs[r] = oldC;
  sol.durs[r] = oldD;
  return total;
}

/** Inserta la parada donde menos empeora el total, entre todas las rutas y posiciones. */
function insertCheapest(
  ctx: Ctx,
  sol: Solution,
  scratch: ReturnType<typeof newMetrics>,
  s: number,
): void {
  let bestTotal = Infinity;
  let bestR = 0;
  let bestPos = 0;
  const tmp: number[] = [];
  let emptyTried = false;
  for (let r = 0; r < sol.routes.length; r++) {
    // Todas las rutas vacías son equivalentes: alcanza con probar la primera.
    if (sol.routes[r].length === 0) {
      if (emptyTried) continue;
      emptyTried = true;
    }
    for (let pos = 0; pos <= sol.routes[r].length; pos++) {
      const total = insertionTotal(ctx, sol, scratch, r, pos, s, tmp);
      if (total < bestTotal - EPS) {
        bestTotal = total;
        bestR = r;
        bestPos = pos;
      }
    }
  }
  sol.routes[bestR].splice(bestPos, 0, s);
  evalRoute(ctx, sol.routes[bestR], scratch);
  sol.costs[bestR] = scratch.cost;
  sol.durs[bestR] = scratch.duration;
  sol.total = totalCost(ctx, sol.costs, sol.durs);
}

function construct(ctx: Ctx, scratch: ReturnType<typeof newMetrics>): Solution {
  const sol = evaluateAll(
    ctx,
    Array.from({ length: ctx.vehicles }, () => [] as number[]),
  );
  // Primero las que tienen ventana (las más urgentes antes), después las demás de las más lejanas a las más cercanas.
  const order = Array.from({ length: ctx.n }, (_, i) => i).sort((x, y) => {
    const wx = Number.isFinite(ctx.to[x]);
    const wy = Number.isFinite(ctx.to[y]);
    if (wx !== wy) return wx ? -1 : 1;
    if (wx && wy) return ctx.to[x] - ctx.to[y];
    return ctx.travel[ctx.node[y]] - ctx.travel[ctx.node[x]]; // desde el depósito (fila 0)
  });
  for (const s of order) insertCheapest(ctx, sol, scratch, s);
  return sol;
}

// ---------------------------------------------------------------- búsqueda local

/** Mejora la solución con movimientos hasta que ninguno mejora (óptimo local). */
export function localSearch(
  ctx: Ctx,
  sol: Solution,
  scratch: ReturnType<typeof newMetrics>,
): void {
  const R = sol.routes.length;
  let improved = true;
  while (improved) {
    improved = false;

    // 1) Mover un tramo de 1 a 3 paradas (en un sentido o invertido) a otra posición o ruta.
    for (let a = 0; a < R && !improved; a++) {
      for (let len = 1; len <= 3 && !improved; len++) {
        for (let p = 0; p + len <= sol.routes[a].length && !improved; p++) {
          const seg = sol.routes[a].slice(p, p + len);
          const base = sol.routes[a]
            .slice(0, p)
            .concat(sol.routes[a].slice(p + len));
          for (let b = 0; b < R && !improved; b++) {
            const target = b === a ? base : sol.routes[b];
            for (let q = 0; q <= target.length && !improved; q++) {
              if (b === a && q === p) continue;
              for (const piece of len === 1
                ? [seg]
                : [seg, seg.slice().reverse()]) {
                const moved = target.slice(0, q).concat(piece, target.slice(q));
                if (b === a) improved = tryChange(ctx, sol, scratch, a, moved);
                else improved = tryChange(ctx, sol, scratch, a, base, b, moved);
                if (improved) break;
              }
            }
          }
        }
      }
    }
    if (improved) continue;

    // 2) Intercambiar dos paradas (de la misma ruta o de rutas distintas).
    for (let a = 0; a < R && !improved; a++) {
      for (let b = a; b < R && !improved; b++) {
        for (let p = 0; p < sol.routes[a].length && !improved; p++) {
          for (
            let q = b === a ? p + 1 : 0;
            q < sol.routes[b].length && !improved;
            q++
          ) {
            if (a === b) {
              const na = sol.routes[a].slice();
              [na[p], na[q]] = [na[q], na[p]];
              improved = tryChange(ctx, sol, scratch, a, na);
            } else {
              const na = sol.routes[a].slice();
              const nb = sol.routes[b].slice();
              [na[p], nb[q]] = [nb[q], na[p]];
              improved = tryChange(ctx, sol, scratch, a, na, b, nb);
            }
          }
        }
      }
    }
    if (improved) continue;

    // 3) 2-opt dentro de una ruta: invertir un tramo.
    for (let a = 0; a < R && !improved; a++) {
      const route = sol.routes[a];
      for (let p = 0; p < route.length - 1 && !improved; p++) {
        for (let q = p + 1; q < route.length && !improved; q++) {
          const na = route
            .slice(0, p)
            .concat(route.slice(p, q + 1).reverse(), route.slice(q + 1));
          improved = tryChange(ctx, sol, scratch, a, na);
        }
      }
    }
    if (improved) continue;

    // 4) 2-opt* entre rutas: intercambiar las "colas" de dos camiones.
    for (let a = 0; a < R && !improved; a++) {
      for (let b = a + 1; b < R && !improved; b++) {
        const ra = sol.routes[a];
        const rb = sol.routes[b];
        for (let cutA = 0; cutA <= ra.length && !improved; cutA++) {
          for (let cutB = 0; cutB <= rb.length && !improved; cutB++) {
            if (
              (cutA === ra.length && cutB === rb.length) ||
              (cutA === 0 && cutB === 0)
            )
              continue;
            const na = ra.slice(0, cutA).concat(rb.slice(cutB));
            const nb = rb.slice(0, cutB).concat(ra.slice(cutA));
            improved = tryChange(ctx, sol, scratch, a, na, b, nb);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- destruir y reconstruir

/** Saca entre 2 y 5 paradas (al azar, un tramo seguido, o las más cercanas entre sí) y las vuelve a meter donde convenga. */
function ruinAndRecreate(
  ctx: Ctx,
  sol: Solution,
  rng: Rng,
  scratch: ReturnType<typeof newMetrics>,
): void {
  const k = Math.min(ctx.n, 2 + rng.int(4));
  const all: number[] = [];
  sol.routes.forEach((r) => all.push(...r));
  let removed: number[];
  const mode = rng.int(3);
  if (mode === 0) {
    removed = shuffle(all.slice(), rng).slice(0, k);
  } else if (mode === 1) {
    const candidates = sol.routes
      .map((r, i) => i)
      .filter((i) => sol.routes[i].length > 0);
    const r = sol.routes[candidates[rng.int(candidates.length)]];
    const len = Math.min(k, r.length);
    const start = rng.int(r.length - len + 1);
    removed = r.slice(start, start + len);
  } else {
    const seed = all[rng.int(all.length)];
    const near = all
      .filter((s) => s !== seed)
      .sort(
        (x, y) =>
          ctx.travel[ctx.node[seed] * ctx.size + ctx.node[x]] -
          ctx.travel[ctx.node[seed] * ctx.size + ctx.node[y]],
      );
    removed = [seed, ...near.slice(0, k - 1)];
  }
  const gone = new Set(removed);
  for (let r = 0; r < sol.routes.length; r++) {
    if (sol.routes[r].some((s) => gone.has(s))) {
      sol.routes[r] = sol.routes[r].filter((s) => !gone.has(s));
      evalRoute(ctx, sol.routes[r], scratch);
      sol.costs[r] = scratch.cost;
      sol.durs[r] = scratch.duration;
    }
  }
  sol.total = totalCost(ctx, sol.costs, sol.durs);
  shuffle(removed, rng);
  for (const s of removed) insertCheapest(ctx, sol, scratch, s);
}

export interface IlsLimits {
  timeBudgetMs: number;
  maxIterations: number;
  /** Iteraciones seguidas sin mejorar tras las cuales se corta (por defecto max(800, 100 × paradas)). */
  stagnationLimit?: number;
  now: () => number;
}

export interface IlsResult {
  best: Solution;
  iterations: number;
}

/** Búsqueda iterada: construir, mejorar, y repetir "destruir y reconstruir + mejorar" con aceptación por temple simulado. */
export function runIls(ctx: Ctx, rng: Rng, limits: IlsLimits): IlsResult {
  const scratch = newMetrics();
  const startedAt = limits.now();
  let current = construct(ctx, scratch);
  localSearch(ctx, current, scratch);
  let best = cloneSolution(current);

  // Con muy pocas paradas la búsqueda local ya encuentra el óptimo.
  if (ctx.n <= 2) return { best, iterations: 0 };

  const stagnationLimit = limits.stagnationLimit ?? Math.max(800, 100 * ctx.n);
  const startTemp = 0.004 * Math.max(best.total, 1);
  let iterations = 0;
  let sinceImprovement = 0;
  while (
    iterations < limits.maxIterations &&
    sinceImprovement < stagnationLimit
  ) {
    const elapsed = limits.now() - startedAt;
    if (elapsed >= limits.timeBudgetMs) break;
    iterations++;
    const progress = Math.max(
      iterations / limits.maxIterations,
      elapsed / limits.timeBudgetMs,
    );
    const temp = startTemp * Math.max(0, 1 - progress);

    const candidate = cloneSolution(current);
    ruinAndRecreate(ctx, candidate, rng, scratch);
    localSearch(ctx, candidate, scratch);
    const delta = candidate.total - current.total;
    if (delta < -EPS || (temp > 0 && rng.next() < Math.exp(-delta / temp)))
      current = candidate;
    if (current.total < best.total - EPS) {
      best = cloneSolution(current);
      sinceImprovement = 0;
    } else {
      sinceImprovement++;
    }
  }
  return { best, iterations };
}
