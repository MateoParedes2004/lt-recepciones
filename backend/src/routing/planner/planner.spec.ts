import { buildCtx } from './context';
import { evalRoute, newMetrics } from './evaluate';
import { solveBranchAndBound, solveEnumeration, solveHeldKarp } from './exact';
import { makeRng } from './ils';
import { solve } from './planner';
import { PlannerProblem, PlannerStop } from './types';

// ------------------------------------------------------------------ utilidades de prueba

const HOUR = 3600;
const MIN = 60;

/** Instancia aleatoria repetible: puntos en un plano, tiempos asimétricos, ventanas en parte de las paradas. */
function randomProblem(
  seed: number,
  n: number,
  vehicles: number,
  windowShare: number,
): PlannerProblem {
  const rng = makeRng(seed);
  const pts = Array.from({ length: n + 1 }, () => [
    rng.next() * 30,
    rng.next() * 30,
  ]); // km
  const travelSec: number[][] = [];
  const distanceM: number[][] = [];
  for (let i = 0; i <= n; i++) {
    travelSec.push([]);
    distanceM.push([]);
    for (let j = 0; j <= n; j++) {
      const km =
        i === j
          ? 0
          : Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) * 1.3;
      const asym = i < j ? 1 : 1.07; // ida y vuelta no cuestan lo mismo (sentidos de calle)
      travelSec[i].push(Math.round((km / 30) * 3600 * asym)); // 30 km/h
      distanceM[i].push(Math.round(km * 1000 * asym));
    }
  }
  const startSec = 8 * HOUR;
  const stops: PlannerStop[] = Array.from({ length: n }, (_, i) => {
    const stop: PlannerStop = {
      id: `S${i + 1}`,
      node: i + 1,
      serviceSec: (10 + rng.int(21)) * MIN,
    };
    if (rng.next() < windowShare) {
      const from = startSec + rng.int(5 * 4) * 15 * MIN; // cada 15 min, hasta 5 h después
      stop.window = {
        fromSec: from,
        toSec: from + (30 + rng.int(7) * 15) * MIN,
      };
    }
    return stop;
  });
  return { startSec, travelSec, distanceM, stops, vehicles };
}

/**
 * ORÁCULO independiente: costo de un plan simulado a mano (no usa evalRoute) y
 * búsqueda por fuerza bruta de todas las permutaciones.
 */
function oracleCost(
  p: PlannerProblem,
  routes: number[][],
  lateWeight = 10,
): number {
  const w = p.options?.makespanWeight ?? (p.vehicles > 1 ? 0.3 : 0);
  let sum = 0;
  let maxDur = 0;
  for (const r of routes) {
    if (r.length === 0) continue;
    let t = p.startSec;
    let at = 0;
    let late = 0;
    for (const s of r) {
      const stop = p.stops[s];
      t += p.travelSec[at][stop.node];
      if (stop.window) {
        if (t < stop.window.fromSec) t = stop.window.fromSec;
        else if (t > stop.window.toSec) late += t - stop.window.toSec;
      }
      t += stop.serviceSec;
      at = stop.node;
    }
    t += p.travelSec[at][0];
    const dur = t - p.startSec;
    sum += dur + lateWeight * late;
    maxDur = Math.max(maxDur, dur);
  }
  return sum + w * maxDur;
}

function bruteForce(p: PlannerProblem): number {
  const n = p.stops.length;
  const items = n + p.vehicles - 1;
  const perm = Array.from({ length: items }, (_, i) => i);
  let best = Infinity;
  const go = (k: number): void => {
    if (k === items) {
      const routes: number[][] = [[]];
      for (const x of perm) {
        if (x >= n) routes.push([]);
        else routes[routes.length - 1].push(x);
      }
      best = Math.min(best, oracleCost(p, routes));
      return;
    }
    for (let i = k; i < items; i++) {
      [perm[k], perm[i]] = [perm[i], perm[k]];
      go(k + 1);
      [perm[k], perm[i]] = [perm[i], perm[k]];
    }
  };
  go(0);
  return best;
}

const cheap = { timeBudgetMs: 300, maxIterations: 4000, stagnationLimit: 250 };

// ------------------------------------------------------------------ evaluador

describe('evaluador de rutas', () => {
  // Depósito (0) → A (1) → B (2) → depósito. A tarda 10 min en llegar, B 20 min desde A, la vuelta 15 min.
  const base = (overrides: Partial<PlannerProblem> = {}): PlannerProblem => ({
    startSec: 8 * HOUR,
    travelSec: [
      [0, 10 * MIN, 30 * MIN],
      [10 * MIN, 0, 20 * MIN],
      [15 * MIN, 20 * MIN, 0],
    ],
    distanceM: [
      [0, 5000, 15000],
      [5000, 0, 9000],
      [7000, 9000, 0],
    ],
    stops: [
      { id: 'A', node: 1, serviceSec: 30 * MIN },
      { id: 'B', node: 2, serviceSec: 20 * MIN },
    ],
    vehicles: 1,
    ...overrides,
  });

  it('suma viaje + atención y calcula los horarios de cada parada', () => {
    const plan = solve({ ...base(), options: { skipExact: true } });
    const r = plan.routes[0];
    expect(r.stops.map((s) => s.id)).toEqual(['A', 'B']);
    expect(r.stops[0]).toMatchObject({
      arriveSec: 8 * HOUR + 10 * MIN,
      startSec: 8 * HOUR + 10 * MIN,
      departSec: 8 * HOUR + 40 * MIN,
      waitSec: 0,
      lateSec: 0,
      legSec: 10 * MIN,
      legM: 5000,
    });
    expect(r.stops[1]).toMatchObject({
      arriveSec: 9 * HOUR,
      departSec: 9 * HOUR + 20 * MIN,
      legSec: 20 * MIN,
      legM: 9000,
    });
    expect(r.travelSec).toBe((10 + 20 + 15) * MIN);
    expect(r.distanceM).toBe(5000 + 9000 + 7000);
    expect(r.endSec).toBe(9 * HOUR + 35 * MIN); // 9:20 + 15 min de vuelta
    expect(r.durationSec).toBe(95 * MIN);
    expect(plan.totals).toMatchObject({
      stops: 2,
      finishSec: 9 * HOUR + 35 * MIN,
    });
  });

  it('esperar si se llega antes de la ventana, y marcar el atraso si se llega después', () => {
    // Una sola parada: la espera es inevitable (llega 8:10, abre 9:00).
    const early = solve({
      ...base({
        stops: [
          {
            id: 'A',
            node: 1,
            serviceSec: 30 * MIN,
            window: { fromSec: 9 * HOUR, toSec: 10 * HOUR },
          },
        ],
      }),
      options: { skipExact: true },
    });
    const a = early.routes[0].stops[0];
    expect(a.waitSec).toBe(50 * MIN);
    expect(a.startSec).toBe(9 * HOUR);
    expect(early.totals.waitSec).toBe(50 * MIN);

    // Con dos paradas el optimizador evita esa espera: visita primero la que no tiene ventana.
    const smart = solve({
      ...base({
        stops: [
          {
            id: 'A',
            node: 1,
            serviceSec: 30 * MIN,
            window: { fromSec: 9 * HOUR, toSec: 10 * HOUR },
          },
          { id: 'B', node: 2, serviceSec: 20 * MIN },
        ],
      }),
      options: { skipExact: true },
    });
    expect(smart.routes[0].stops.map((s) => s.id)).toEqual(['B', 'A']);
    expect(smart.totals.waitSec).toBe(0);

    // Ventana que ya cerró cuando se puede llegar (llegada mínima 8:10 > 8:05): atraso inevitable de 5 min.
    const late = solve({
      ...base({
        stops: [
          {
            id: 'A',
            node: 1,
            serviceSec: 30 * MIN,
            window: { fromSec: 8 * HOUR, toSec: 8 * HOUR + 5 * MIN },
          },
          { id: 'B', node: 2, serviceSec: 20 * MIN },
        ],
      }),
      options: { skipExact: true },
    });
    const la = late.routes[0].stops.find((s) => s.id === 'A')!;
    expect(la.lateSec).toBe(5 * MIN);
    expect(late.totals.lateSec).toBe(5 * MIN);
  });

  it('el costo del plan coincide con el del oráculo independiente', () => {
    const problem = randomProblem(7, 6, 1, 0.5);
    const plan = solve({ ...problem, options: cheap });
    const order = plan.routes[0].stops.map((s) => Number(s.id.slice(1)) - 1);
    expect(plan.cost).toBeCloseTo(oracleCost(problem, [order]), 6);
  });

  it('una ruta vacía no cuesta nada', () => {
    const ctx = buildCtx(randomProblem(1, 3, 1, 0));
    expect(evalRoute(ctx, [], newMetrics()).cost).toBe(0);
  });
});

// ------------------------------------------------------------------ exactos vs oráculo

describe('solvers exactos', () => {
  it('Held-Karp encuentra el óptimo (1 camión, sin ventanas)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const n = 4 + (seed % 5); // 4..8
      const p = randomProblem(seed, n, 1, 0);
      const order = solveHeldKarp(buildCtx(p));
      expect(oracleCost(p, [order])).toBeCloseTo(bruteForce(p), 6);
    }
  });

  it('Held-Karp admite rutas abiertas (sin volver al depósito)', () => {
    const p = {
      ...randomProblem(3, 6, 1, 0),
      options: { returnToDepot: false },
    };
    const ctx = buildCtx(p);
    const order = solveHeldKarp(ctx);
    const m = evalRoute(ctx, order, newMetrics());
    // Fuerza bruta de rutas abiertas.
    let best = Infinity;
    const perm = [0, 1, 2, 3, 4, 5];
    const go = (k: number): void => {
      if (k === 6) {
        best = Math.min(best, evalRoute(ctx, perm, newMetrics()).cost);
        return;
      }
      for (let i = k; i < 6; i++) {
        [perm[k], perm[i]] = [perm[i], perm[k]];
        go(k + 1);
        [perm[k], perm[i]] = [perm[i], perm[k]];
      }
    };
    go(0);
    expect(m.cost).toBeCloseTo(best, 6);
  });

  it('ramificación y poda encuentra el óptimo con ventanas horarias', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const n = 4 + (seed % 5);
      const p = randomProblem(100 + seed, n, 1, 0.6);
      const ctx = buildCtx(p);
      const result = solveBranchAndBound(ctx, Infinity);
      expect(result.complete).toBe(true);
      expect(result.order).not.toBeNull();
      expect(oracleCost(p, [result.order!])).toBeCloseTo(bruteForce(p), 6);
    }
  });

  it('la enumeración completa es exacta con varios camiones', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const vehicles = 2 + (seed % 2); // 2 o 3
      const n = vehicles === 2 ? 5 : 4;
      const p = randomProblem(200 + seed, n, vehicles, 0.4);
      const result = solveEnumeration(buildCtx(p));
      expect(result.total).toBeCloseTo(bruteForce(p), 6);
    }
  });
});

// ------------------------------------------------------------------ la heurística contra el óptimo

describe('heurística (sin ayuda del solver exacto)', () => {
  it('iguala al óptimo en 120 problemas chicos al azar (1 y 2 camiones, con y sin ventanas)', () => {
    let optimal = 0;
    const misses: string[] = [];
    for (let k = 0; k < 120; k++) {
      const n = 4 + (k % 4); // 4..7
      const vehicles = 1 + (k % 2);
      const p = randomProblem(1000 + k, n, vehicles, k % 3 === 0 ? 0 : 0.5);
      const plan = solve({
        ...p,
        options: { ...cheap, stagnationLimit: 120, skipExact: true },
      });
      const truth = bruteForce(p);
      if (plan.cost <= truth + 1e-6) optimal++;
      else
        misses.push(
          `seed ${1000 + k}: ${plan.cost.toFixed(0)} vs ${truth.toFixed(0)}`,
        );
    }
    expect(misses).toEqual([]);
    expect(optimal).toBe(120);
  });

  it('con 8 y 9 paradas (1 camión) también da el óptimo', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const p = randomProblem(
        3000 + seed,
        8 + (seed % 2),
        1,
        seed % 2 ? 0 : 0.5,
      );
      const plan = solve({ ...p, options: { ...cheap, skipExact: true } });
      expect(plan.cost).toBeLessThanOrEqual(bruteForce(p) + 1e-6);
    }
  });
});

// ------------------------------------------------------------------ solve() completo

describe('solve()', () => {
  it('marca el plan como óptimo (certificado) cuando el problema es chico', () => {
    const plan = solve({ ...randomProblem(11, 9, 1, 0), options: cheap }); // Held-Karp
    expect(plan.optimal).toBe(true);
    expect(plan.method).toBe('exact');
    const windows = solve({ ...randomProblem(12, 8, 1, 0.6), options: cheap }); // ramificación y poda
    expect(windows.optimal).toBe(true);
    const two = solve({ ...randomProblem(13, 5, 2, 0.4), options: cheap }); // enumeración
    expect(two.optimal).toBe(true);
  });

  it('con más paradas no promete optimalidad, pero asigna todas exactamente una vez', () => {
    const p = randomProblem(21, 30, 2, 0.4);
    const plan = solve({ ...p, options: cheap });
    expect(plan.optimal).toBe(false);
    expect(plan.method).toBe('heuristic');
    const ids = plan.routes.flatMap((r) => r.stops.map((s) => s.id)).sort();
    expect(ids).toEqual(p.stops.map((s) => s.id).sort());
    expect(plan.totals.stops).toBe(30);
  });

  it('el costo informado es exactamente el de recalcular las rutas finales', () => {
    const p = randomProblem(22, 20, 2, 0.5);
    const plan = solve({ ...p, options: cheap });
    const routes = plan.routes.map((r) =>
      r.stops.map((s) => Number(s.id.slice(1)) - 1),
    );
    expect(plan.cost).toBeCloseTo(oracleCost(p, routes), 6);
  });

  it('es determinista: misma semilla, mismo plan', () => {
    const p = randomProblem(23, 25, 2, 0.4);
    const a = solve({ ...p, options: { ...cheap, seed: 5 } });
    const b = solve({ ...p, options: { ...cheap, seed: 5 } });
    expect(b.routes.map((r) => r.stops.map((s) => s.id))).toEqual(
      a.routes.map((r) => r.stops.map((s) => s.id)),
    );
    expect(b.cost).toBe(a.cost);
  });

  it('respeta el tiempo máximo en problemas grandes', () => {
    const p = randomProblem(24, 40, 3, 0.5);
    const t = performance.now();
    const plan = solve({
      ...p,
      options: { timeBudgetMs: 300, maxIterations: 100000 },
    });
    expect(performance.now() - t).toBeLessThan(1500);
    expect(plan.totals.stops).toBe(40);
  });

  it('mejora claramente el orden "el más cercano primero"', () => {
    // Promedio de varias instancias: la optimización tiene que ganarle al método ingenuo.
    let nnTotal = 0;
    let solved = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const p = randomProblem(400 + seed, 15, 1, 0);
      const left = new Set(p.stops.map((_, i) => i));
      const order: number[] = [];
      let at = 0;
      while (left.size) {
        let b = -1;
        let bc = Infinity;
        for (const s of left)
          if (p.travelSec[at][p.stops[s].node] < bc) {
            bc = p.travelSec[at][p.stops[s].node];
            b = s;
          }
        order.push(b);
        left.delete(b);
        at = p.stops[b].node;
      }
      nnTotal += oracleCost(p, [order]);
      solved += solve({ ...p, options: cheap }).cost;
    }
    expect(solved).toBeLessThan(nnTotal);
  });

  it('con varios camiones termina antes que con uno solo', () => {
    const p = randomProblem(25, 12, 1, 0);
    const one = solve({ ...p, vehicles: 1, options: cheap });
    const three = solve({ ...p, vehicles: 3, options: cheap });
    expect(three.totals.finishSec).toBeLessThan(one.totals.finishSec);
    expect(three.routes.length).toBeGreaterThan(1);
  });

  it('un camión de sobra queda sin usar y los números de camión no tienen huecos', () => {
    const p = randomProblem(26, 2, 4, 0);
    const plan = solve({ ...p, options: cheap });
    expect(plan.routes.map((r) => r.vehicle)).toEqual(
      plan.routes.map((_, i) => i + 1),
    );
    expect(plan.routes.length).toBeLessThanOrEqual(2);
  });

  it('una ventana imposible no descarta la parada: queda con atraso informado', () => {
    const p = randomProblem(27, 4, 1, 0);
    p.stops[2].window = { fromSec: 8 * HOUR, toSec: 8 * HOUR + 1 }; // cerrada casi al salir
    const plan = solve({ ...p, options: cheap });
    expect(plan.totals.stops).toBe(4);
    expect(plan.totals.lateSec).toBeGreaterThan(0);
    // ... y la parada con ventana se atiende lo antes posible.
    expect(plan.routes[0].stops[0].id).toBe('S3');
  });

  it('sin paradas devuelve un plan vacío', () => {
    const p = randomProblem(28, 0, 1, 0);
    const plan = solve(p);
    expect(plan.routes).toEqual([]);
    expect(plan.totals.stops).toBe(0);
    expect(plan.optimal).toBe(true);
  });

  it('con una sola parada: ida, atención y vuelta', () => {
    const p = randomProblem(29, 1, 2, 0);
    const plan = solve(p);
    expect(plan.routes).toHaveLength(1);
    expect(plan.routes[0].stops).toHaveLength(1);
    expect(plan.routes[0].travelSec).toBe(
      p.travelSec[0][1] + p.travelSec[1][0],
    );
  });

  it('un tramo sin ruta (valor enorme) se evita si hay alternativa', () => {
    const p = randomProblem(30, 5, 1, 0);
    p.travelSec[1][2] = 10 * 24 * HOUR; // no se puede ir de la parada 1 a la 2
    const plan = solve({ ...p, options: cheap });
    const ids = plan.routes[0].stops.map((s) => s.id);
    expect(ids.indexOf('S1') + 1).not.toBe(ids.indexOf('S2'));
    expect(plan.totals.travelSec).toBeLessThan(10 * 24 * HOUR);
  });

  it('valida los datos de entrada con mensajes claros', () => {
    const ok = randomProblem(31, 3, 1, 0);
    expect(() =>
      solve({ ...ok, stops: [{ id: 'X', node: 0, serviceSec: 0 }] }),
    ).toThrow(/nodo inválido/);
    expect(() =>
      solve({
        ...ok,
        stops: [
          { id: 'A', node: 1, serviceSec: 0 },
          { id: 'A', node: 2, serviceSec: 0 },
        ],
      }),
    ).toThrow(/repetidos/);
    expect(() =>
      solve({
        ...ok,
        stops: [
          { id: 'A', node: 1, serviceSec: 0 },
          { id: 'B', node: 1, serviceSec: 0 },
        ],
      }),
    ).toThrow(/comparten el nodo/);
    expect(() =>
      solve({
        ...ok,
        stops: [
          {
            id: 'A',
            node: 1,
            serviceSec: 0,
            window: { fromSec: 10, toSec: 5 },
          },
        ],
      }),
    ).toThrow(/termina antes de empezar/);
    expect(() =>
      solve({ ...ok, travelSec: ok.travelSec.map((r) => r.slice(1)) }),
    ).toThrow(/cuadrada/);
    const bad = randomProblem(32, 3, 1, 0);
    bad.travelSec[1][2] = Number.NaN;
    expect(() => solve(bad)).toThrow(/valor inválido/);
  });
});
