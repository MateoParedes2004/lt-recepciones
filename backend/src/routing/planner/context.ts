import { PlannerProblem } from './types';

/**
 * El problema ya normalizado y en arreglos planos: es lo que usan el
 * evaluador y los solvers. Se arma una sola vez por plan.
 */
export interface Ctx {
  /** Cantidad de paradas (sin contar el depósito). */
  n: number;
  /** Tamaño de las matrices (n + 1). */
  size: number;
  startSec: number;
  /** travel[i * size + j]: segundos de i a j (índices de nodo, 0 = depósito). */
  travel: Float64Array;
  dist: Float64Array;
  /** Nodo de cada parada (índice 0..n-1 de parada -> nodo de la matriz). */
  node: Int32Array;
  service: Float64Array;
  /** Ventana: -Infinity / Infinity si la parada no tiene. */
  from: Float64Array;
  to: Float64Array;
  hasWindows: boolean;
  vehicles: number;
  returnToDepot: boolean;
  lateWeight: number;
  makespanWeight: number;
}

export const DEFAULT_LATE_WEIGHT = 10;
export const DEFAULT_MAKESPAN_WEIGHT_MULTI = 0.3;

/** Valida el problema y lo convierte en un contexto. Lanza un error claro si algo no cierra. */
export function buildCtx(problem: PlannerProblem): Ctx {
  const n = problem.stops.length;
  const matrixSize = problem.travelSec.length;
  if (matrixSize === 0) throw new Error('La matriz de tiempos está vacía.');
  for (const [name, m] of [
    ['travelSec', problem.travelSec],
    ['distanceM', problem.distanceM],
  ] as const) {
    if (m.length !== matrixSize || m.some((row) => row.length !== matrixSize)) {
      throw new Error(
        `La matriz ${name} tiene que ser cuadrada y del mismo tamaño que travelSec.`,
      );
    }
  }
  const nodes = new Set<number>();
  for (const s of problem.stops) {
    if (!Number.isInteger(s.node) || s.node < 1 || s.node >= matrixSize) {
      throw new Error(
        `La parada ${s.id} tiene un nodo inválido (${s.node}); el 0 es el depósito.`,
      );
    }
    if (nodes.has(s.node))
      throw new Error(`Dos paradas comparten el nodo ${s.node}.`);
    nodes.add(s.node);
    if (!Number.isFinite(s.serviceSec) || s.serviceSec < 0)
      throw new Error(
        `La parada ${s.id} tiene un tiempo de atención inválido.`,
      );
    if (s.window && !(s.window.toSec >= s.window.fromSec))
      throw new Error(`La ventana de ${s.id} termina antes de empezar.`);
  }
  if (new Set(problem.stops.map((s) => s.id)).size !== n)
    throw new Error('Hay identificadores de parada repetidos.');
  if (!Number.isFinite(problem.startSec))
    throw new Error('La hora de salida es inválida.');

  const vehicles = Math.max(1, Math.floor(problem.vehicles || 1));
  const opts = problem.options ?? {};
  const travel = new Float64Array(matrixSize * matrixSize);
  const dist = new Float64Array(matrixSize * matrixSize);
  for (let i = 0; i < matrixSize; i++) {
    for (let j = 0; j < matrixSize; j++) {
      const t = problem.travelSec[i][j];
      const d = problem.distanceM[i][j];
      if (!Number.isFinite(t) || t < 0 || !Number.isFinite(d) || d < 0) {
        throw new Error(
          `Las matrices tienen un valor inválido en (${i}, ${j}). Reemplazá los tramos sin ruta por un valor grande antes de optimizar.`,
        );
      }
      travel[i * matrixSize + j] = i === j ? 0 : t;
      dist[i * matrixSize + j] = i === j ? 0 : d;
    }
  }
  const from = new Float64Array(n).fill(-Infinity);
  const to = new Float64Array(n).fill(Infinity);
  let hasWindows = false;
  problem.stops.forEach((s, i) => {
    if (s.window) {
      from[i] = s.window.fromSec;
      to[i] = s.window.toSec;
      hasWindows = true;
    }
  });
  return {
    n,
    size: matrixSize,
    startSec: problem.startSec,
    travel,
    dist,
    node: Int32Array.from(problem.stops.map((s) => s.node)),
    service: Float64Array.from(problem.stops.map((s) => s.serviceSec)),
    from,
    to,
    hasWindows,
    vehicles,
    returnToDepot: opts.returnToDepot ?? true,
    lateWeight: opts.lateWeight ?? DEFAULT_LATE_WEIGHT,
    makespanWeight:
      opts.makespanWeight ?? (vehicles > 1 ? DEFAULT_MAKESPAN_WEIGHT_MULTI : 0),
  };
}
