import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toDayIndex } from '../../common/timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { DEPOT, GeoPoint, isValidPoint } from '../geo';
import { solve } from '../planner/planner';
import type { PlannerProblem, PlannerStop } from '../planner/types';
import { RoutingService } from '../routing.service';
import { scaleDurations } from '../travel-matrix';
import {
  DEFAULT_START_TIME,
  DEFAULT_TRAFFIC_FACTOR,
  DEFAULT_VEHICLES,
  hhmmToSec,
  isNextDay,
  mapsDirectionsUrl,
  mapsPointUrl,
  mapsRouteUrls,
  MAX_STOPS_PER_PLAN,
  secToHhmm,
  serviceMinutes,
  StopKind,
  windowFromHhmm,
} from './dispatch';
import type {
  DispatchPlan,
  PlanRouteView,
  PlanStopView,
  SkippedStop,
} from './dispatch.types';
import type { PlanDayDto } from './dto/plan-day.dto';
import type { StopAction } from './dto/update-stop.dto';

const RENTAL_FOR_DISPATCH = {
  items: { select: { quantity: true } },
  city: { select: { name: true } },
} satisfies Prisma.RentalInclude;

type DispatchRental = Prisma.RentalGetPayload<{
  include: typeof RENTAL_FOR_DISPATCH;
}>;

/** Una parada posible del día, antes de optimizar. */
interface Candidate {
  key: string;
  kind: StopKind;
  rental: DispatchRental;
  point: GeoPoint;
  units: number;
  overdueDays: number;
  windowFrom: string | null;
  windowTo: string | null;
  serviceMin: number;
  /** Fila de este punto en la matriz (el 0 es el depósito). */
  node: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;
const KIND_LABEL: Record<StopKind, string> = {
  ENTREGA: 'La entrega',
  RETIRO: 'El retiro',
};

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: RoutingService,
  ) {}

  // ------------------------------------------------------------------ plan del día

  /**
   * Arma el plan de reparto de un día: qué entregar, qué retirar, en qué
   * orden y a qué hora se llega a cada lugar. Con `save` también lo guarda.
   */
  async plan(dto: PlanDayDto): Promise<DispatchPlan> {
    const dateUtc = this.parseDate(dto.date);
    const startTime = dto.startTime ?? DEFAULT_START_TIME;
    const vehicles = dto.vehicles ?? DEFAULT_VEHICLES;
    const trafficFactor = dto.trafficFactor ?? DEFAULT_TRAFFIC_FACTOR;

    const { candidates, skipped } = await this.loadCandidates(
      dateUtc,
      dto.includeDeliveries !== false,
      dto.includePickups !== false,
    );
    if (candidates.length > MAX_STOPS_PER_PLAN) {
      throw new BadRequestException(
        `Ese día hay ${candidates.length} paradas con ubicación y el máximo por plan es ${MAX_STOPS_PER_PLAN}. Dividí el reparto (por ejemplo, solo entregas o solo retiros).`,
      );
    }

    const base = {
      date: dto.date,
      startTime,
      vehicles,
      trafficFactor,
      skipped,
      saved: null,
    };
    if (candidates.length === 0) {
      return {
        ...base,
        matrix: { method: 'route', provider: null, warning: null },
        solver: { optimal: true, method: 'exact', iterations: 0, elapsedMs: 0 },
        totals: totalsOf([], startTime),
        routes: [],
        warnings: skipped.length
          ? []
          : ['No hay entregas ni retiros con ubicación para ese día.'],
      };
    }

    const points: GeoPoint[] = [DEPOT, ...candidates.map((c) => c.point)];
    const matrix = await this.routing.travelMatrix(points);

    // Un punto sin ruta por calle desde o hacia el depósito no se puede visitar.
    const unreachable = new Set<number>();
    for (const [i, j] of matrix.missing) {
      if (i === 0) unreachable.add(j);
      else if (j === 0) unreachable.add(i);
    }
    const usable: Candidate[] = [];
    for (const c of candidates) {
      if (unreachable.has(c.node)) {
        skipped.push(
          skip(
            c,
            'No hay ruta por calle desde el depósito hasta esa ubicación (¿cayó en un lugar sin calles cerca? Revisá las coordenadas).',
          ),
        );
      } else usable.push(c);
    }

    const scaled = scaleDurations(matrix, trafficFactor);
    const stops: PlannerStop[] = usable.map((c) => ({
      id: c.key,
      node: c.node,
      serviceSec: c.serviceMin * 60,
      window: windowFromHhmm(c.windowFrom, c.windowTo),
    }));
    const problem: PlannerProblem = {
      startSec: hhmmToSec(startTime),
      travelSec: scaled.durationSec,
      distanceM: matrix.distanceM,
      stops,
      vehicles,
    };
    const result = solve(problem);

    const byKey = new Map(usable.map((c) => [c.key, c]));
    const routes: PlanRouteView[] = result.routes.map((route) => {
      const views = route.stops.map((ps) =>
        stopView(byKey.get(ps.id)!, {
          arriveSec: ps.arriveSec,
          waitSec: ps.waitSec,
          lateSec: ps.lateSec,
          legSec: ps.legSec,
          legM: ps.legM,
        }),
      );
      return {
        vehicle: route.vehicle,
        stops: views,
        travelMin: round1(route.travelSec / 60),
        km: round1(route.distanceM / 1000),
        serviceMin: Math.round(route.serviceSec / 60),
        waitMin: Math.round(route.waitSec / 60),
        lateMin: Math.round(route.lateSec / 60),
        endTime: secToHhmm(route.endSec),
        endMin: Math.round(route.endSec / 60),
        durationMin: Math.round(route.durationSec / 60),
        mapsUrls: mapsRouteUrls(views.map((s) => ({ lat: s.lat, lng: s.lng }))),
      };
    });

    const plan: DispatchPlan = {
      ...base,
      matrix: {
        method: matrix.method,
        provider: matrix.provider,
        warning: matrix.warning,
      },
      solver: {
        optimal: result.optimal,
        method: result.method,
        iterations: result.iterations,
        elapsedMs: Math.round(result.elapsedMs),
      },
      totals: totalsOf(routes, startTime),
      routes,
      skipped,
      warnings: [],
    };
    plan.warnings = buildWarnings(plan, usable.length);

    if (dto.save) {
      const runId = await this.persist(
        dateUtc,
        plan,
        byKey,
        dto.replace === true,
      );
      plan.saved = { runId };
      // Los ids de cada parada guardada, para poder marcar "llegué" / "listo".
      const saved = await this.prisma.deliveryStop.findMany({
        where: { runId },
        select: { id: true, rentalId: true, kind: true },
      });
      const idOf = new Map(saved.map((s) => [`${s.kind}-${s.rentalId}`, s.id]));
      for (const r of plan.routes)
        for (const s of r.stops) s.stopId = idOf.get(s.key);
    }
    return plan;
  }

  // ------------------------------------------------------------------ ruta guardada

  /** La ruta guardada de un día (con el avance de cada parada), o null si no hay. */
  async getRun(date: string): Promise<DispatchPlan | null> {
    const dateUtc = this.parseDate(date);
    const run = await this.prisma.deliveryRun.findUnique({
      where: { date: dateUtc },
      include: {
        routes: true,
        stops: {
          orderBy: [{ vehicle: 'asc' }, { sequence: 'asc' }],
          include: { rental: { include: RENTAL_FOR_DISPATCH } },
        },
      },
    });
    if (!run) return null;
    const routeOf = new Map(run.routes.map((r) => [r.vehicle, r]));

    const byVehicle = new Map<number, typeof run.stops>();
    for (const s of run.stops) {
      const list = byVehicle.get(s.vehicle) ?? [];
      list.push(s);
      byVehicle.set(s.vehicle, list);
    }
    const warnings: string[] = [];
    const routes: PlanRouteView[] = [...byVehicle.entries()]
      .sort(([a], [b]) => a - b)
      .map(([vehicle, stops]) => {
        const views = stops.map((s) => {
          const kind = s.kind as StopKind;
          const c = candidateFrom(s.rental, kind, dateUtc, 0);
          if (!c) return null;
          c.serviceMin = s.plannedServiceMin;
          const view = stopView(c, {
            arriveSec: s.plannedArriveMin * 60,
            waitSec: 0,
            lateSec: 0,
            legSec: s.plannedLegMin * 60,
            legM: s.plannedLegKm * 1000,
          });
          // Espera y atraso se derivan de la ventana y la llegada planificada.
          const win = windowFromHhmm(c.windowFrom, c.windowTo);
          if (win) {
            view.waitMin = Math.max(
              0,
              Math.round(win.fromSec / 60) - s.plannedArriveMin,
            );
            view.lateMin = Math.max(
              0,
              s.plannedArriveMin - Math.round(win.toSec / 60),
            );
          }
          view.stopId = s.id;
          view.arrivedAt = s.arrivedAt?.toISOString() ?? null;
          view.completedAt = s.completedAt?.toISOString() ?? null;
          if (s.rental.status !== 'ACTIVO') {
            warnings.push(
              `${KIND_LABEL[kind]} de ${s.rental.clientName} ya no está ${kind === 'ENTREGA' ? 'activa' : 'activo'} (${s.rental.status === 'CANCELADO' ? 'anulado' : s.rental.status.toLowerCase()}).`,
            );
          }
          return view;
        });
        const ok = views.filter((v): v is PlanStopView => v !== null);
        // Los totales del camión, tal como se planificaron (incluyen el regreso al depósito).
        const saved = routeOf.get(vehicle);
        return {
          vehicle,
          stops: ok,
          travelMin: saved?.travelMin ?? 0,
          km: saved?.km ?? 0,
          serviceMin: saved?.serviceMin ?? 0,
          waitMin: saved?.waitMin ?? 0,
          lateMin: saved?.lateMin ?? 0,
          endTime: secToHhmm((saved?.endMinutes ?? run.startMinutes) * 60),
          endMin: saved?.endMinutes ?? run.startMinutes,
          durationMin: saved?.durationMin ?? 0,
          mapsUrls: mapsRouteUrls(ok.map((s) => ({ lat: s.lat, lng: s.lng }))),
        };
      });

    // Alquileres que aparecieron después de guardar y no están en la ruta.
    const current = await this.loadCandidates(dateUtc, true, true);
    const inRun = new Set(run.stops.map((s) => `${s.kind}-${s.rentalId}`));
    const added = current.candidates.filter((c) => !inRun.has(c.key));
    if (added.length > 0) {
      warnings.push(
        `Hay ${added.length} ${added.length === 1 ? 'parada nueva que no está' : 'paradas nuevas que no están'} en esta ruta (${added.map((c) => `${c.kind === 'ENTREGA' ? 'entrega' : 'retiro'} de ${c.rental.clientName}`).join(', ')}). Recalculá para incluirlas.`,
      );
    }

    const startTime = secToHhmm(run.startMinutes * 60);
    const plan: DispatchPlan = {
      date,
      startTime,
      vehicles: run.vehicles,
      trafficFactor: run.trafficFactor,
      matrix: {
        method: run.matrixMethod === 'route' ? 'route' : 'estimate',
        provider: run.matrixProvider,
        warning:
          run.matrixMethod === 'route'
            ? null
            : 'Los tiempos de esta ruta eran aproximados.',
      },
      solver: {
        optimal: run.optimal,
        method: run.optimal ? 'exact' : 'heuristic',
        iterations: 0,
        elapsedMs: 0,
      },
      totals: totalsOf(routes, startTime),
      routes,
      skipped: [],
      warnings,
      saved: { runId: run.id },
    };
    return plan;
  }

  /** Marca el avance de una parada: llegué / listo / deshacer. */
  async updateStop(id: number, action: StopAction) {
    const stop = await this.prisma.deliveryStop.findUnique({ where: { id } });
    if (!stop) throw new NotFoundException(`La parada ${id} no existe.`);
    const now = new Date();
    const data: Prisma.DeliveryStopUpdateInput =
      action === 'arrive'
        ? { arrivedAt: stop.arrivedAt ?? now }
        : action === 'complete'
          ? {
              arrivedAt: stop.arrivedAt ?? now,
              completedAt: stop.completedAt ?? now,
            }
          : { arrivedAt: null, completedAt: null };
    const updated = await this.prisma.deliveryStop.update({
      where: { id },
      data,
      select: { id: true, arrivedAt: true, completedAt: true },
    });
    return {
      stopId: updated.id,
      arrivedAt: updated.arrivedAt?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
    };
  }

  /** Borra la ruta guardada de un día. */
  async deleteRun(date: string) {
    const result = await this.prisma.deliveryRun.deleteMany({
      where: { date: this.parseDate(date) },
    });
    return { deleted: result.count > 0 };
  }

  // ------------------------------------------------------------------ internos

  /** Fecha de calendario AAAA-MM-DD → medianoche UTC. Rechaza fechas que no existen (30 de febrero). */
  private parseDate(date: string): Date {
    const d = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException(`La fecha ${date} no existe.`);
    }
    return d;
  }

  /**
   * Las paradas posibles del día: entregas de los alquileres que arrancan ese
   * día, y retiros de los que terminan ese día o ya se pasaron de fecha y
   * siguen sin devolverse (atrasados).
   */
  private async loadCandidates(
    dateUtc: Date,
    deliveries: boolean,
    pickups: boolean,
  ): Promise<{ candidates: Candidate[]; skipped: SkippedStop[] }> {
    const rentals = await this.prisma.rental.findMany({
      where: {
        status: 'ACTIVO',
        OR: [{ eventDate: dateUtc }, { returnDate: { lte: dateUtc } }],
      },
      include: RENTAL_FOR_DISPATCH,
      orderBy: { id: 'asc' },
    });
    const candidates: Candidate[] = [];
    const skipped: SkippedStop[] = [];
    const wants: [StopKind, boolean, (r: DispatchRental) => boolean][] = [
      [
        'ENTREGA',
        deliveries,
        (r) => r.eventDate.getTime() === dateUtc.getTime(),
      ],
      ['RETIRO', pickups, (r) => r.returnDate.getTime() <= dateUtc.getTime()],
    ];
    for (const rental of rentals) {
      for (const [kind, enabled, applies] of wants) {
        if (!enabled || !applies(rental)) continue;
        const sameDay =
          rental.eventDate.getTime() === rental.returnDate.getTime();
        const c = candidateFrom(rental, kind, dateUtc, candidates.length + 1);
        if (!c) {
          skipped.push({
            rentalId: rental.id,
            kind,
            clientName: rental.clientName,
            reason:
              'Sin ubicación de entrega: cargala en el alquiler para incluirlo en la ruta.',
          });
        } else if (
          kind === 'RETIRO' &&
          sameDay &&
          !c.windowFrom &&
          !c.windowTo
        ) {
          // Entrega y retiro el mismo día: sin horario de retiro no hay forma
          // de saber que va después de la entrega (el optimizador no lo infiere).
          skipped.push(
            skip(
              c,
              'Entrega y retiro el mismo día: cargá el horario de retiro para incluirlo (así queda después de la entrega).',
            ),
          );
        } else candidates.push(c);
      }
    }
    return { candidates, skipped };
  }

  /** Guarda el plan como la ruta de ese día (reemplaza la anterior). Devuelve el id. */
  private async persist(
    dateUtc: Date,
    plan: DispatchPlan,
    byKey: Map<string, Candidate>,
    replace: boolean,
  ): Promise<number> {
    const rows = plan.routes.flatMap((route) =>
      route.stops.map((s, i) => {
        const c = byKey.get(s.key)!;
        return {
          rentalId: c.rental.id,
          kind: c.kind,
          vehicle: route.vehicle,
          sequence: i + 1,
          plannedArriveMin: s.arriveMin,
          plannedServiceMin: s.serviceMin,
          plannedLegMin: s.legMin,
          plannedLegKm: s.legKm,
        };
      }),
    );
    const run = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.deliveryRun.findUnique({
          where: { date: dateUtc },
          include: {
            stops: { select: { arrivedAt: true, completedAt: true } },
          },
        });
        if (existing) {
          const started = existing.stops.some(
            (s) => s.arrivedAt || s.completedAt,
          );
          if (started && !replace) {
            throw new ConflictException(
              'Ya hay una ruta guardada para ese día con paradas marcadas como "llegué" o "listo". Si la reemplazás se pierde ese avance: confirmalo para continuar.',
            );
          }
          await tx.deliveryRun.delete({ where: { id: existing.id } });
        }
        return tx.deliveryRun.create({
          data: {
            date: dateUtc,
            startMinutes: Math.round(hhmmToSec(plan.startTime) / 60),
            vehicles: plan.vehicles,
            trafficFactor: plan.trafficFactor,
            matrixMethod: plan.matrix.method,
            matrixProvider: plan.matrix.provider,
            optimal: plan.solver.optimal,
            totalKm: plan.totals.km,
            totalTravelMin: plan.totals.travelMin,
            finishMinutes: Math.round(
              plan.routes.reduce((m, r) => Math.max(m, r.endMin), 0),
            ),
            routes: {
              create: plan.routes.map((r) => ({
                vehicle: r.vehicle,
                travelMin: r.travelMin,
                km: r.km,
                serviceMin: r.serviceMin,
                waitMin: r.waitMin,
                lateMin: r.lateMin,
                endMinutes: r.endMin,
                durationMin: r.durationMin,
              })),
            },
            stops: { create: rows },
          },
          select: { id: true },
        });
      },
      { timeout: 15000 },
    );
    return run.id;
  }
}

// ---------------------------------------------------------------------- funciones puras

function skip(c: Candidate, reason: string): SkippedStop {
  return {
    rentalId: c.rental.id,
    kind: c.kind,
    clientName: c.rental.clientName,
    reason,
  };
}

/** Arma la parada posible de un alquiler, o null si no tiene una ubicación válida. */
function candidateFrom(
  rental: DispatchRental,
  kind: StopKind,
  dateUtc: Date,
  node: number,
): Candidate | null {
  if (rental.deliveryLat === null || rental.deliveryLng === null) return null;
  const point = { lat: rental.deliveryLat, lng: rental.deliveryLng };
  if (!isValidPoint(point)) return null;
  const units = rental.items.reduce((sum, i) => sum + i.quantity, 0);
  const pickup = kind === 'RETIRO';
  return {
    key: `${kind}-${rental.id}`,
    kind,
    rental,
    point,
    units,
    overdueDays: pickup
      ? Math.max(0, toDayIndex(dateUtc) - toDayIndex(rental.returnDate))
      : 0,
    windowFrom: pickup ? rental.pickupWindowFrom : rental.deliveryWindowFrom,
    windowTo: pickup ? rental.pickupWindowTo : rental.deliveryWindowTo,
    serviceMin: serviceMinutes(kind, units),
    node,
  };
}

function stopView(
  c: Candidate,
  t: {
    arriveSec: number;
    waitSec: number;
    lateSec: number;
    legSec: number;
    legM: number;
  },
): PlanStopView {
  return {
    key: c.key,
    kind: c.kind,
    rentalId: c.rental.id,
    clientName: c.rental.clientName,
    clientPhone: c.rental.clientPhone || null,
    address: c.rental.deliveryAddress,
    cityName: c.rental.city?.name ?? null,
    lat: c.point.lat,
    lng: c.point.lng,
    units: c.units,
    overdueDays: c.overdueDays,
    windowFrom: c.windowFrom,
    windowTo: c.windowTo,
    serviceMin: c.serviceMin,
    arrive: secToHhmm(t.arriveSec),
    arriveMin: Math.round(t.arriveSec / 60),
    nextDay: isNextDay(t.arriveSec),
    waitMin: Math.round(t.waitSec / 60),
    lateMin: Math.round(t.lateSec / 60),
    legMin: Math.round(t.legSec / 60),
    legKm: round1(t.legM / 1000),
    pointUrl: mapsPointUrl(c.point),
    directionsUrl: mapsDirectionsUrl(c.point),
  };
}

function totalsOf(
  routes: PlanRouteView[],
  startTime: string,
): DispatchPlan['totals'] {
  const all = routes.flatMap((r) => r.stops);
  const finish = routes.reduce(
    (m, r) => Math.max(m, r.endMin),
    hhmmToSec(startTime) / 60,
  );
  return {
    stops: all.length,
    deliveries: all.filter((s) => s.kind === 'ENTREGA').length,
    pickups: all.filter((s) => s.kind === 'RETIRO').length,
    km: round1(routes.reduce((a, r) => a + r.km, 0)),
    travelMin: round1(routes.reduce((a, r) => a + r.travelMin, 0)),
    serviceMin: routes.reduce((a, r) => a + r.serviceMin, 0),
    waitMin: routes.reduce((a, r) => a + r.waitMin, 0),
    lateMin: routes.reduce((a, r) => a + r.lateMin, 0),
    finishTime: secToHhmm(finish * 60),
  };
}

/** Avisos para el admin: lo que conviene mirar antes de salir. */
export function buildWarnings(plan: DispatchPlan, planned: number): string[] {
  const out: string[] = [];
  if (plan.matrix.warning) out.push(plan.matrix.warning);
  const all = plan.routes.flatMap((r) => r.stops);
  for (const s of all) {
    const what = s.kind === 'ENTREGA' ? 'La entrega' : 'El retiro';
    if (s.lateMin >= 1) {
      out.push(
        `${what} de ${s.clientName} llegaría ${s.lateMin} min tarde (el horario pedido termina a las ${s.windowTo ?? '—'}).`,
      );
    }
    if (s.waitMin >= 20) {
      out.push(
        `Hay que esperar ${s.waitMin} min en ${s.clientName}: se llega antes de las ${s.windowFrom ?? '—'}.`,
      );
    }
    if (s.overdueDays > 0) {
      out.push(
        `El retiro de ${s.clientName} está atrasado ${s.overdueDays} ${s.overdueDays === 1 ? 'día' : 'días'}.`,
      );
    }
    if (s.nextDay) {
      out.push(
        `${what} de ${s.clientName} cae pasada la medianoche: el plan es demasiado largo para un día.`,
      );
    }
  }
  // Retiro programado antes que la entrega del mismo alquiler.
  const at = new Map(all.map((s) => [s.key, s]));
  for (const s of all) {
    if (s.kind !== 'RETIRO') continue;
    const delivery = at.get(`ENTREGA-${s.rentalId}`);
    if (delivery && s.arriveMin < delivery.arriveMin + delivery.serviceMin) {
      out.push(
        `El retiro de ${s.clientName} quedó antes que su entrega. Ajustá el horario de retiro.`,
      );
    }
  }
  if (plan.routes.length < plan.vehicles && planned > 0 && plan.vehicles > 1) {
    out.push(
      `Con ${planned} ${planned === 1 ? 'parada' : 'paradas'} alcanza con ${plan.routes.length} ${plan.routes.length === 1 ? 'camión' : 'camiones'}: el resto queda libre.`,
    );
  }
  return out;
}
