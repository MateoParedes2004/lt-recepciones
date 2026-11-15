import type { StopKind } from './dispatch';

/** Una parada del plan, lista para mostrar en el panel. */
export interface PlanStopView {
  /** Identificador estable dentro del plan: "ENTREGA-12" o "RETIRO-12". */
  key: string;
  kind: StopKind;
  rentalId: number;
  clientName: string;
  clientPhone: string | null;
  /** Referencia escrita para el que entrega ("portón negro"). */
  address: string | null;
  cityName: string | null;
  lat: number;
  lng: number;
  /** Cuántas unidades se mueven (para estimar la atención y avisar la carga). */
  units: number;
  /** Retiro atrasado: cuántos días pasaron de la fecha de devolución (0 si no). */
  overdueDays: number;
  windowFrom: string | null;
  windowTo: string | null;
  serviceMin: number;
  /** Hora estimada de llegada, "HH:MM". */
  arrive: string;
  arriveMin: number;
  /** El plan se pasó de la medianoche: esta parada cae en el día siguiente. */
  nextDay: boolean;
  waitMin: number;
  lateMin: number;
  /** Viaje desde la parada anterior (o el depósito). */
  legMin: number;
  legKm: number;
  pointUrl: string;
  directionsUrl: string;
  /** Solo si el plan está guardado. */
  stopId?: number;
  arrivedAt?: string | null;
  completedAt?: string | null;
}

export interface PlanRouteView {
  vehicle: number;
  stops: PlanStopView[];
  travelMin: number;
  km: number;
  serviceMin: number;
  waitMin: number;
  lateMin: number;
  /** Hora de regreso al depósito (o de la última parada si no vuelve). */
  endTime: string;
  /** Lo mismo en minutos desde la medianoche (puede pasar de 1440 si el plan se extiende al día siguiente). */
  endMin: number;
  durationMin: number;
  /** Links de Google Maps con todo el recorrido (más de uno si son muchas paradas). */
  mapsUrls: string[];
}

export interface SkippedStop {
  rentalId: number;
  kind: StopKind;
  clientName: string;
  reason: string;
}

export interface DispatchPlan {
  /** AAAA-MM-DD. */
  date: string;
  startTime: string;
  vehicles: number;
  trafficFactor: number;
  matrix: {
    /** 'route' = por calle; 'estimate' = aproximados. */
    method: 'route' | 'estimate';
    /** Servicio a acreditar en pantalla ("Powered by …"), si hubo. */
    provider: string | null;
    warning: string | null;
  };
  solver: {
    /** true = el mejor plan posible demostrado. */
    optimal: boolean;
    method: 'exact' | 'heuristic';
    iterations: number;
    elapsedMs: number;
  };
  totals: {
    stops: number;
    deliveries: number;
    pickups: number;
    km: number;
    travelMin: number;
    serviceMin: number;
    waitMin: number;
    lateMin: number;
    finishTime: string;
  };
  routes: PlanRouteView[];
  /** Alquileres que no entraron en el plan, y por qué. */
  skipped: SkippedStop[];
  /** Avisos para el admin (atrasos, esperas largas, tiempos aproximados…). */
  warnings: string[];
  /** Presente si el plan está guardado. */
  saved: { runId: number } | null;
}
