/**
 * Tipos del optimizador de rutas de entrega.
 *
 * Es una librería pura (sin Nest, sin Prisma, sin red): recibe los tiempos de
 * viaje ya calculados y devuelve el plan. Así se puede probar de punta a punta
 * y reutilizar tal cual en la futura app de recorridos.
 *
 * Unidades: tiempos en SEGUNDOS, distancias en METROS. Las horas del día se
 * expresan como segundos desde la medianoche local (08:00 = 28800).
 */

/** Una parada a visitar (una entrega o un retiro). */
export interface PlannerStop {
  /** Identificador propio de quien llama (ej. "ENTREGA-12"); vuelve igual en el resultado. */
  id: string;
  /** Fila y columna de este punto en las matrices. El 0 es siempre el depósito. */
  node: number;
  /** Tiempo que se queda en el lugar (descargar y armar, o desarmar y cargar). */
  serviceSec: number;
  /**
   * Ventana horaria en la que tiene que COMENZAR la atención. Llegar antes de
   * `fromSec` obliga a esperar; llegar después de `toSec` es "tarde" y se
   * penaliza (no se descarta la parada: el admin decide).
   */
  window?: { fromSec: number; toSec: number };
}

export interface PlannerOptions {
  /** Si cada camión vuelve al depósito al terminar (por defecto sí). */
  returnToDepot?: boolean;
  /**
   * Cuánto pesa cada segundo de atraso frente a un segundo de manejo.
   * Por defecto 10: llegar 10 minutos tarde "cuesta" como manejar 100 minutos.
   */
  lateWeight?: number;
  /**
   * Con varios camiones, cuánto pesa que el último termine pronto (además del
   * tiempo total). 0 = solo importa el tiempo total de todos. Por defecto 0,3
   * si hay más de un camión, y 0 si hay uno.
   */
  makespanWeight?: number;
  /** Semilla del azar: misma semilla, mismo plan (repetible y probable). */
  seed?: number;
  /** Tiempo máximo de búsqueda heurística. En un servidor lento conviene dejar margen. */
  timeBudgetMs?: number;
  /** Tope de iteraciones de la búsqueda heurística. */
  maxIterations?: number;
  /**
   * Cantidad de búsquedas independientes (con semillas distintas) entre las
   * que se reparte el tiempo; se queda con la mejor. Una sola búsqueda puede
   * quedar atrapada en un óptimo local; varias lo evitan. Por defecto 1 si
   * después corre un solver exacto (que verifica o corrige el resultado) y 3
   * si no.
   */
  restarts?: number;
  /**
   * Corta la búsqueda si pasan tantas iteraciones seguidas sin mejorar el
   * mejor plan. Por defecto max(800, 100 × paradas).
   */
  stagnationLimit?: number;
  /** Desactiva la verificación exacta (los solvers exactos para problemas chicos). */
  skipExact?: boolean;
}

export interface PlannerProblem {
  /** Hora de salida del depósito, en segundos desde la medianoche. */
  startSec: number;
  /** Segundos de viaje de i a j. Matriz cuadrada (paradas + depósito), puede ser asimétrica. */
  travelSec: number[][];
  /** Metros de i a j. Mismo tamaño que travelSec. */
  distanceM: number[][];
  stops: PlannerStop[];
  /** Cantidad de camiones disponibles (mínimo 1). Los que sobren quedan sin usar. */
  vehicles: number;
  options?: PlannerOptions;
}

/** Una parada ya ubicada en el plan, con sus horarios calculados. */
export interface PlannedStop {
  id: string;
  /** Segundos desde la medianoche en que llega. */
  arriveSec: number;
  /** Cuando empieza a atender (si llegó antes de la ventana, espera hasta la hora de apertura). */
  startSec: number;
  /** Cuando termina y sale. */
  departSec: number;
  /** Espera por llegar antes de la ventana. */
  waitSec: number;
  /** Atraso respecto del final de la ventana (0 si llegó a tiempo). */
  lateSec: number;
  /** Viaje desde la parada anterior (o el depósito). */
  legSec: number;
  legM: number;
}

export interface PlannedRoute {
  /** Número de camión (1, 2, ...). */
  vehicle: number;
  stops: PlannedStop[];
  travelSec: number;
  distanceM: number;
  serviceSec: number;
  waitSec: number;
  lateSec: number;
  /** Hora a la que termina el recorrido (vuelta al depósito si corresponde). */
  endSec: number;
  /** Duración total, de la salida al fin. */
  durationSec: number;
}

export type PlanMethod = 'exact' | 'heuristic';

export interface PlanResult {
  /** Solo los camiones que tienen paradas. */
  routes: PlannedRoute[];
  totals: {
    stops: number;
    travelSec: number;
    distanceM: number;
    serviceSec: number;
    waitSec: number;
    lateSec: number;
    /** Hora a la que termina el último camión. */
    finishSec: number;
  };
  /** Valor de la función objetivo (para comparar planes entre sí). */
  cost: number;
  /** 'exact' = demostrablemente óptimo; 'heuristic' = muy bueno, sin prueba de optimalidad. */
  method: PlanMethod;
  optimal: boolean;
  iterations: number;
  elapsedMs: number;
}
