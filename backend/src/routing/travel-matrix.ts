import { GeoPoint, haversineKm, ROAD_FACTOR } from './geo';
import type { TravelMatrix } from './providers/route-provider';

/**
 * Velocidad media supuesta para estimar tiempos cuando no hay servicio de
 * rutas. Es una cifra conservadora para Gran Asunción (Geoapify da en
 * promedio 35 a 50 km/h sin tráfico en los tramos que probamos).
 */
export const ESTIMATE_SPEED_KMH = 35;

/** Tiempo que se asigna a un tramo sin ruta por calle: tan grande que el optimizador lo evita siempre que haya alternativa. */
export const UNREACHABLE_SEC = 12 * 3600;

export interface CompleteMatrix {
  durationSec: number[][];
  distanceM: number[][];
}

/** Matriz aproximada: línea recta × factor de calle, a velocidad media. */
export function estimateMatrix(points: GeoPoint[]): CompleteMatrix {
  const n = points.length;
  const durationSec: number[][] = [];
  const distanceM: number[][] = [];
  for (let i = 0; i < n; i++) {
    durationSec.push([]);
    distanceM.push([]);
    for (let j = 0; j < n; j++) {
      const km = i === j ? 0 : haversineKm(points[i], points[j]) * ROAD_FACTOR;
      distanceM[i].push(Math.round(km * 1000));
      durationSec[i].push(Math.round((km / ESTIMATE_SPEED_KMH) * 3600));
    }
  }
  return { durationSec, distanceM };
}

/**
 * Pasa una matriz del proveedor (con `null` donde no hay ruta) a una matriz
 * completa que el optimizador pueda usar. Los tramos sin ruta reciben un
 * tiempo enorme y una distancia estimada, y se informan aparte.
 */
export function completeMatrix(
  matrix: TravelMatrix,
  points: GeoPoint[],
): { matrix: CompleteMatrix; missing: [number, number][] } {
  const n = points.length;
  const durationSec: number[][] = [];
  const distanceM: number[][] = [];
  const missing: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    durationSec.push([]);
    distanceM.push([]);
    for (let j = 0; j < n; j++) {
      if (i === j) {
        durationSec[i].push(0);
        distanceM[i].push(0);
        continue;
      }
      const t = matrix.durationSec[i][j];
      const d = matrix.distanceM[i][j];
      if (t === null || d === null) {
        missing.push([i, j]);
        durationSec[i].push(UNREACHABLE_SEC);
        distanceM[i].push(
          Math.round(haversineKm(points[i], points[j]) * ROAD_FACTOR * 1000),
        );
      } else {
        durationSec[i].push(Math.round(t));
        distanceM[i].push(Math.round(d));
      }
    }
  }
  return { matrix: { durationSec, distanceM }, missing };
}

/** Multiplica los tiempos de viaje (no las distancias) por un factor de tráfico. */
export function scaleDurations(
  matrix: CompleteMatrix,
  factor: number,
): CompleteMatrix {
  if (factor === 1) return matrix;
  return {
    distanceM: matrix.distanceM,
    durationSec: matrix.durationSec.map((row) =>
      row.map((v) => (v >= UNREACHABLE_SEC ? v : Math.round(v * factor))),
    ),
  };
}
