/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method -- la base simulada imita a Prisma de forma laxa a propósito */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { DEPOT } from '../geo';
import { RoutingService, type PlanMatrix } from '../routing.service';
import { estimateMatrix, UNREACHABLE_SEC } from '../travel-matrix';
import {
  hhmmToSec,
  isNextDay,
  mapsDirectionsUrl,
  mapsPointUrl,
  mapsRouteUrls,
  secToHhmm,
  serviceMinutes,
  windowFromHhmm,
} from './dispatch';
import type { DispatchPlan } from './dispatch.types';
import { buildWarnings, DispatchService } from './dispatch.service';

// ------------------------------------------------------------------ funciones puras

describe('horas', () => {
  it('HH:MM ↔ segundos', () => {
    expect(hhmmToSec('08:00')).toBe(28800);
    expect(hhmmToSec('23:59')).toBe(86340);
    expect(secToHhmm(28800)).toBe('08:00');
    expect(secToHhmm(9 * 3600 + 30 * 60 + 29)).toBe('09:30'); // redondea al minuto
    expect(secToHhmm(9 * 3600 + 30 * 60 + 31)).toBe('09:31');
  });

  it('rechaza horas inválidas', () => {
    for (const bad of ['24:00', '8:00', '08:60', 'ab:cd', '', '08:00:00']) {
      expect(() => hhmmToSec(bad)).toThrow(/Hora inválida/);
    }
  });

  it('pasada la medianoche vuelve a empezar y se marca como día siguiente', () => {
    expect(secToHhmm(25 * 3600 + 10 * 60)).toBe('01:10');
    expect(isNextDay(25 * 3600)).toBe(true);
    expect(isNextDay(23 * 3600)).toBe(false);
  });

  it('ventana horaria: con un solo extremo, el otro queda abierto', () => {
    expect(windowFromHhmm(null, null)).toBeUndefined();
    expect(windowFromHhmm('09:00', '12:00')).toEqual({
      fromSec: 32400,
      toSec: 43200,
    });
    expect(windowFromHhmm('09:00', null)).toEqual({
      fromSec: 32400,
      toSec: 86399,
    });
    expect(windowFromHhmm(null, '12:00')).toEqual({ fromSec: 0, toSec: 43200 });
  });
});

describe('tiempo de atención', () => {
  it('crece con las unidades, con tope', () => {
    expect(serviceMinutes('ENTREGA', 0)).toBe(15);
    expect(serviceMinutes('ENTREGA', 200)).toBe(25); // 15 + 200/20
    expect(serviceMinutes('ENTREGA', 5000)).toBe(60); // tope
    expect(serviceMinutes('RETIRO', 200)).toBe(18); // 10 + 200/25
    expect(serviceMinutes('RETIRO', 5000)).toBe(45);
  });
  it('un retiro es más rápido que una entrega con la misma carga', () => {
    expect(serviceMinutes('RETIRO', 300)).toBeLessThan(
      serviceMinutes('ENTREGA', 300),
    );
  });
});

describe('links de Google Maps', () => {
  const stops = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      lat: -25.3 - i * 0.01,
      lng: -57.6,
    }));

  it('un punto y las indicaciones para llegar', () => {
    const p = { lat: -25.28, lng: -57.63 };
    expect(mapsPointUrl(p)).toBe(
      'https://www.google.com/maps/search/?api=1&query=-25.280000,-57.630000',
    );
    expect(mapsDirectionsUrl(p)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-25.280000,-57.630000&travelmode=driving',
    );
  });

  it('el recorrido sale del depósito, pasa por las paradas en orden y vuelve', () => {
    const [url] = mapsRouteUrls(stops(3));
    const q = new URL(url).searchParams;
    expect(q.get('origin')).toBe(
      `${DEPOT.lat.toFixed(6)},${DEPOT.lng.toFixed(6)}`,
    );
    expect(q.get('destination')).toBe(
      `${DEPOT.lat.toFixed(6)},${DEPOT.lng.toFixed(6)}`,
    ); // vuelve al depósito
    expect(q.get('waypoints')!.split('|')).toHaveLength(3);
    expect(q.get('travelmode')).toBe('driving');
  });

  it('sin vuelta, el destino es la última parada', () => {
    const list = stops(3);
    const [url] = mapsRouteUrls(list, false);
    const q = new URL(url).searchParams;
    expect(q.get('destination')).toBe('-25.320000,-57.600000');
    expect(q.get('waypoints')!.split('|')).toHaveLength(2);
  });

  it('con muchas paradas parte el recorrido en tramos consecutivos de a lo sumo 9 intermedias', () => {
    const urls = mapsRouteUrls(stops(23)); // 23 paradas + vuelta = 24 puntos → 3 links
    expect(urls).toHaveLength(3);
    let previousDestination = `${DEPOT.lat.toFixed(6)},${DEPOT.lng.toFixed(6)}`;
    for (const url of urls) {
      const q = new URL(url).searchParams;
      expect(q.get('origin')).toBe(previousDestination); // cada tramo arranca donde terminó el anterior
      expect(
        (q.get('waypoints') ?? '').split('|').filter(Boolean).length,
      ).toBeLessThanOrEqual(9);
      previousDestination = q.get('destination')!;
    }
    expect(previousDestination).toBe(
      `${DEPOT.lat.toFixed(6)},${DEPOT.lng.toFixed(6)}`,
    );
  });

  it('sin paradas ni vuelta no hay links', () => {
    expect(mapsRouteUrls([], false)).toEqual([]);
  });
});

// ------------------------------------------------------------------ avisos

describe('buildWarnings', () => {
  const stop = (over: Partial<DispatchPlan['routes'][0]['stops'][0]> = {}) =>
    ({
      key: 'ENTREGA-1',
      kind: 'ENTREGA',
      rentalId: 1,
      clientName: 'Marina',
      clientPhone: null,
      address: null,
      cityName: null,
      lat: 0,
      lng: 0,
      units: 10,
      overdueDays: 0,
      windowFrom: null,
      windowTo: null,
      serviceMin: 15,
      arrive: '09:00',
      arriveMin: 540,
      nextDay: false,
      waitMin: 0,
      lateMin: 0,
      legMin: 10,
      legKm: 3,
      pointUrl: '',
      directionsUrl: '',
      ...over,
    }) as DispatchPlan['routes'][0]['stops'][0];
  const plan = (
    stops: ReturnType<typeof stop>[],
    over: Partial<DispatchPlan> = {},
  ): DispatchPlan => ({
    date: '2026-11-20',
    startTime: '08:00',
    vehicles: 1,
    trafficFactor: 1.3,
    matrix: { method: 'route', provider: 'Geoapify', warning: null },
    solver: { optimal: true, method: 'exact', iterations: 0, elapsedMs: 0 },
    totals: {
      stops: stops.length,
      deliveries: 0,
      pickups: 0,
      km: 0,
      travelMin: 0,
      serviceMin: 0,
      waitMin: 0,
      lateMin: 0,
      finishTime: '10:00',
    },
    routes: [
      {
        vehicle: 1,
        stops,
        travelMin: 0,
        km: 0,
        serviceMin: 0,
        waitMin: 0,
        lateMin: 0,
        endTime: '10:00',
        endMin: 600,
        durationMin: 0,
        mapsUrls: [],
      },
    ],
    skipped: [],
    warnings: [],
    saved: null,
    ...over,
  });

  it('un plan sin problemas no avisa nada', () => {
    expect(buildWarnings(plan([stop()]), 1)).toEqual([]);
  });
  it('atraso, espera larga, retiro atrasado y pasada la medianoche', () => {
    const w = buildWarnings(
      plan([
        stop({ lateMin: 25, windowTo: '10:00' }),
        stop({
          key: 'ENTREGA-2',
          rentalId: 2,
          clientName: 'Pedro',
          waitMin: 45,
          windowFrom: '11:00',
        }),
        stop({
          key: 'RETIRO-3',
          kind: 'RETIRO',
          rentalId: 3,
          clientName: 'Ana',
          overdueDays: 2,
        }),
        stop({
          key: 'ENTREGA-4',
          rentalId: 4,
          clientName: 'Luis',
          nextDay: true,
        }),
      ]),
      4,
    ).join(' | ');
    expect(w).toMatch(/Marina llegaría 25 min tarde.*10:00/);
    expect(w).toMatch(/esperar 45 min en Pedro.*11:00/);
    expect(w).toMatch(/retiro de Ana está atrasado 2 días/);
    expect(w).toMatch(/Luis cae pasada la medianoche/);
  });
  it('una espera corta no molesta', () => {
    expect(buildWarnings(plan([stop({ waitMin: 10 })]), 1)).toEqual([]);
  });
  it('retiro programado antes que la entrega del mismo alquiler', () => {
    const w = buildWarnings(
      plan([
        stop({ key: 'RETIRO-1', kind: 'RETIRO', arriveMin: 480 }),
        stop({
          key: 'ENTREGA-1',
          kind: 'ENTREGA',
          arriveMin: 540,
          serviceMin: 20,
        }),
      ]),
      2,
    );
    expect(w.join(' ')).toMatch(/retiro de Marina quedó antes que su entrega/);
    const ok = buildWarnings(
      plan([
        stop({ key: 'ENTREGA-1', arriveMin: 480, serviceMin: 20 }),
        stop({ key: 'RETIRO-1', kind: 'RETIRO', arriveMin: 600 }),
      ]),
      2,
    );
    expect(ok).toEqual([]);
  });
  it('incluye el aviso de tiempos aproximados', () => {
    const w = buildWarnings(
      plan([stop()], {
        matrix: {
          method: 'estimate',
          provider: null,
          warning: 'Tiempos aproximados.',
        },
      }),
      1,
    );
    expect(w).toEqual(['Tiempos aproximados.']);
  });
});

// ------------------------------------------------------------------ servicio con base de datos simulada

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

interface FakeRental {
  id: number;
  clientName: string;
  clientPhone: string | null;
  status: string;
  eventDate: Date;
  returnDate: Date;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
  deliveryWindowFrom: string | null;
  deliveryWindowTo: string | null;
  pickupWindowFrom: string | null;
  pickupWindowTo: string | null;
  items: { quantity: number }[];
  city: { name: string } | null;
}

const rental = (over: Partial<FakeRental> & { id: number }): FakeRental => ({
  clientName: `Cliente ${over.id}`,
  clientPhone: '0981 000 000',
  status: 'ACTIVO',
  eventDate: D('2026-11-20'),
  returnDate: D('2026-11-21'),
  deliveryLat: -25.28 - over.id * 0.005,
  deliveryLng: -57.63 + over.id * 0.004,
  deliveryAddress: null,
  deliveryWindowFrom: null,
  deliveryWindowTo: null,
  pickupWindowFrom: null,
  pickupWindowTo: null,
  items: [{ quantity: 100 }],
  city: { name: 'Asunción' },
  ...over,
});

/** Base en memoria que entiende justo las consultas que hace DispatchService. */
function fakeDb(rentals: FakeRental[]) {
  const db = {
    rentals,
    runs: [] as any[],
    stops: [] as any[],
    nextId: 1,
  };
  const withJoins = (run: any) => ({
    ...run,
    routes: db.runs.find((r) => r.id === run.id)!._routes,
    stops: db.stops
      .filter((s) => s.runId === run.id)
      .sort((a, b) => a.vehicle - b.vehicle || a.sequence - b.sequence)
      .map((s) => ({
        ...s,
        rental: db.rentals.find((r) => r.id === s.rentalId)!,
      })),
  });
  const model = {
    rental: {
      findMany: ({ where }: any) =>
        Promise.resolve(
          db.rentals.filter(
            (r) =>
              r.status === where.status &&
              where.OR.some((c: any) =>
                c.eventDate
                  ? r.eventDate.getTime() === c.eventDate.getTime()
                  : r.returnDate.getTime() <= c.returnDate.lte.getTime(),
              ),
          ),
        ),
    },
    deliveryRun: {
      findUnique: ({ where, include }: any) => {
        const run = db.runs.find(
          (r) => r.date.getTime() === where.date.getTime(),
        );
        if (!run) return Promise.resolve(null);
        return Promise.resolve(
          include?.routes
            ? withJoins(run)
            : { ...run, stops: db.stops.filter((s) => s.runId === run.id) },
        );
      },
      delete: ({ where }: any) => {
        db.runs = db.runs.filter((r) => r.id !== where.id);
        db.stops = db.stops.filter((s) => s.runId !== where.id);
        return Promise.resolve({});
      },
      deleteMany: ({ where }: any) => {
        const before = db.runs.length;
        db.runs = db.runs.filter(
          (r) => r.date.getTime() !== where.date.getTime(),
        );
        return Promise.resolve({ count: before - db.runs.length });
      },
      create: ({ data }: any) => {
        const id = db.nextId++;
        const { stops, routes, ...run } = data;
        db.runs.push({
          ...run,
          id,
          _routes: routes.create.map((r: any, i: number) => ({
            ...r,
            id: i + 1,
            runId: id,
          })),
        });
        for (const s of stops.create)
          db.stops.push({
            ...s,
            id: db.nextId++,
            runId: id,
            arrivedAt: null,
            completedAt: null,
          });
        return Promise.resolve({ id });
      },
    },
    deliveryStop: {
      findMany: ({ where }: any) =>
        Promise.resolve(db.stops.filter((s) => s.runId === where.runId)),
      findUnique: ({ where }: any) =>
        Promise.resolve(db.stops.find((s) => s.id === where.id) ?? null),
      update: ({ where, data }: any) => {
        const s = db.stops.find((x) => x.id === where.id)!;
        Object.assign(s, data);
        return Promise.resolve(s);
      },
    },
    $transaction: (fn: any) => fn(model),
  };
  return { db, prisma: model as unknown as PrismaService };
}

/** Servicio de rutas con matriz aproximada (sin red). */
const routingEstimate = () => new RoutingService(null);

describe('DispatchService.plan', () => {
  it('incluye las entregas del día y los retiros del día; deja afuera lo que no corresponde', async () => {
    const { prisma } = fakeDb([
      rental({ id: 1 }), // entrega el 20, retiro el 21
      rental({
        id: 2,
        eventDate: D('2026-11-19'),
        returnDate: D('2026-11-20'),
      }), // retiro el 20
      rental({
        id: 3,
        eventDate: D('2026-11-22'),
        returnDate: D('2026-11-23'),
      }), // otro día
      rental({ id: 4, status: 'DEVUELTO' }), // ya devuelto
      rental({ id: 5, status: 'PRESUPUESTO' }), // presupuesto
    ]);
    const plan = await new DispatchService(prisma, routingEstimate()).plan({
      date: '2026-11-20',
    });
    const keys = plan.routes.flatMap((r) => r.stops.map((s) => s.key)).sort();
    expect(keys).toEqual(['ENTREGA-1', 'RETIRO-2']);
    expect(plan.totals).toMatchObject({ stops: 2, deliveries: 1, pickups: 1 });
  });

  it('un retiro atrasado (devolución anterior, sigue activo) entra y avisa los días de atraso', async () => {
    const { prisma } = fakeDb([
      rental({
        id: 1,
        eventDate: D('2026-11-15'),
        returnDate: D('2026-11-17'),
      }),
    ]);
    const plan = await new DispatchService(prisma, routingEstimate()).plan({
      date: '2026-11-20',
    });
    expect(plan.routes[0].stops[0]).toMatchObject({
      key: 'RETIRO-1',
      overdueDays: 3,
    });
    expect(plan.warnings.join(' ')).toMatch(/atrasado 3 días/);
  });

  it('puede pedirse solo entregas o solo retiros', async () => {
    const { prisma } = fakeDb([
      rental({ id: 1 }),
      rental({
        id: 2,
        eventDate: D('2026-11-19'),
        returnDate: D('2026-11-20'),
      }),
    ]);
    const svc = new DispatchService(prisma, routingEstimate());
    const onlyDeliveries = await svc.plan({
      date: '2026-11-20',
      includePickups: false,
    });
    expect(
      onlyDeliveries.routes.flatMap((r) => r.stops.map((s) => s.kind)),
    ).toEqual(['ENTREGA']);
    const onlyPickups = await svc.plan({
      date: '2026-11-20',
      includeDeliveries: false,
    });
    expect(
      onlyPickups.routes.flatMap((r) => r.stops.map((s) => s.kind)),
    ).toEqual(['RETIRO']);
  });

  it('lo que no tiene ubicación queda afuera, con el motivo', async () => {
    const { prisma } = fakeDb([
      rental({ id: 1 }),
      rental({
        id: 2,
        deliveryLat: null,
        deliveryLng: null,
        clientName: 'Sin punto',
      }),
    ]);
    const plan = await new DispatchService(prisma, routingEstimate()).plan({
      date: '2026-11-20',
    });
    expect(plan.totals.stops).toBe(1);
    expect(plan.skipped).toEqual([
      {
        rentalId: 2,
        kind: 'ENTREGA',
        clientName: 'Sin punto',
        reason: expect.stringMatching(/Sin ubicación/),
      },
    ]);
  });

  it('entrega y retiro el mismo día: el retiro exige horario (si no, no hay cómo ordenarlo después de la entrega)', async () => {
    const sameDay = { eventDate: D('2026-11-20'), returnDate: D('2026-11-20') };
    const without = fakeDb([rental({ id: 1, ...sameDay })]);
    const a = await new DispatchService(without.prisma, routingEstimate()).plan(
      { date: '2026-11-20' },
    );
    expect(a.routes.flatMap((r) => r.stops.map((s) => s.key))).toEqual([
      'ENTREGA-1',
    ]);
    expect(a.skipped[0]).toMatchObject({
      kind: 'RETIRO',
      reason: expect.stringMatching(/cargá el horario de retiro/),
    });

    const withWindow = fakeDb([
      rental({
        id: 1,
        ...sameDay,
        pickupWindowFrom: '22:00',
        pickupWindowTo: '23:30',
      }),
    ]);
    const b = await new DispatchService(
      withWindow.prisma,
      routingEstimate(),
    ).plan({ date: '2026-11-20' });
    const stops = b.routes.flatMap((r) => r.stops);
    expect(stops.map((s) => s.key)).toEqual(['ENTREGA-1', 'RETIRO-1']); // la ventana nocturna lo deja después
    expect(b.skipped).toEqual([]);
  });

  it('respeta el horario pedido: espera si llega antes y avisa si llega tarde', async () => {
    const { prisma } = fakeDb([
      rental({ id: 1, deliveryWindowFrom: '14:00', deliveryWindowTo: '15:00' }), // abre a las 14: hay que esperar
      rental({ id: 2, deliveryWindowFrom: '08:00', deliveryWindowTo: '08:05' }), // ya es imposible llegar a tiempo
    ]);
    const plan = await new DispatchService(prisma, routingEstimate()).plan({
      date: '2026-11-20',
      startTime: '08:00',
    });
    const s1 = plan.routes[0].stops.find((s) => s.key === 'ENTREGA-1')!;
    const s2 = plan.routes[0].stops.find((s) => s.key === 'ENTREGA-2')!;
    expect(s1.arrive >= '14:00' || s1.waitMin > 0).toBe(true);
    expect(s2.lateMin).toBeGreaterThan(0);
    expect(plan.warnings.join(' ')).toMatch(/llegaría \d+ min tarde/);
  });

  it('el tiempo de atención sale de las unidades del alquiler', async () => {
    const { prisma } = fakeDb([
      rental({ id: 1, items: [{ quantity: 150 }, { quantity: 50 }] }),
    ]);
    const plan = await new DispatchService(prisma, routingEstimate()).plan({
      date: '2026-11-20',
    });
    expect(plan.routes[0].stops[0]).toMatchObject({
      units: 200,
      serviceMin: 25,
    });
  });

  it('el factor de tráfico alarga los tiempos de viaje (no los km)', async () => {
    const data = [rental({ id: 1 }), rental({ id: 2 }), rental({ id: 3 })];
    const light = await new DispatchService(
      fakeDb(data).prisma,
      routingEstimate(),
    ).plan({ date: '2026-11-20', trafficFactor: 1 });
    const heavy = await new DispatchService(
      fakeDb(data).prisma,
      routingEstimate(),
    ).plan({ date: '2026-11-20', trafficFactor: 2 });
    expect(heavy.totals.travelMin).toBeGreaterThan(
      light.totals.travelMin * 1.9,
    );
    expect(heavy.totals.km).toBeCloseTo(light.totals.km, 1);
  });

  it('con varios camiones reparte las paradas y termina antes', async () => {
    const data = Array.from({ length: 8 }, (_, i) =>
      rental({
        id: i + 1,
        deliveryLat: -25.2 - (i % 4) * 0.05,
        deliveryLng: -57.5 - Math.floor(i / 4) * 0.2,
      }),
    );
    const one = await new DispatchService(
      fakeDb(data).prisma,
      routingEstimate(),
    ).plan({ date: '2026-11-20', vehicles: 1 });
    const two = await new DispatchService(
      fakeDb(data).prisma,
      routingEstimate(),
    ).plan({ date: '2026-11-20', vehicles: 2 });
    expect(two.routes).toHaveLength(2);
    expect(two.routes.reduce((n, r) => n + r.stops.length, 0)).toBe(8);
    expect(two.totals.finishTime <= one.totals.finishTime).toBe(true);
  });

  it('cada parada trae sus links de Google Maps y los datos para llamar al cliente', async () => {
    const { prisma } = fakeDb([
      rental({
        id: 1,
        clientName: 'Marina',
        clientPhone: '0981 555 666',
        deliveryAddress: 'portón negro',
      }),
    ]);
    const plan = await new DispatchService(prisma, routingEstimate()).plan({
      date: '2026-11-20',
    });
    const s = plan.routes[0].stops[0];
    expect(s).toMatchObject({
      clientName: 'Marina',
      clientPhone: '0981 555 666',
      address: 'portón negro',
      cityName: 'Asunción',
    });
    expect(s.pointUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search/);
    expect(s.directionsUrl).toMatch(/destination=/);
    expect(plan.routes[0].mapsUrls.length).toBeGreaterThan(0);
  });

  it('sin entregas ni retiros devuelve un plan vacío (sin pedir tiempos de ruta)', async () => {
    const { prisma } = fakeDb([]);
    const routing = { travelMatrix: jest.fn() } as unknown as RoutingService;
    const plan = await new DispatchService(prisma, routing).plan({
      date: '2026-11-20',
    });
    expect(plan.routes).toEqual([]);
    expect(plan.warnings).toEqual([
      'No hay entregas ni retiros con ubicación para ese día.',
    ]);
    expect(routing.travelMatrix).not.toHaveBeenCalled();
  });

  it('rechaza más de 30 paradas y fechas que no existen', async () => {
    const many = Array.from({ length: 31 }, (_, i) => rental({ id: i + 1 }));
    const svc = new DispatchService(fakeDb(many).prisma, routingEstimate());
    await expect(svc.plan({ date: '2026-11-20' })).rejects.toThrow(
      /máximo por plan es 30/,
    );
    await expect(svc.plan({ date: '2026-02-30' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.plan({ date: '2026-13-01' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('una parada sin ruta por calle desde el depósito se descarta con su motivo', async () => {
    const { prisma } = fakeDb([
      rental({ id: 1 }),
      rental({ id: 2, clientName: 'En una isla' }),
    ]);
    const points = [
      DEPOT,
      { lat: -25.285, lng: -57.626 },
      { lat: -25.29, lng: -57.622 },
    ];
    const est = estimateMatrix(points);
    est.durationSec[0][2] = UNREACHABLE_SEC;
    est.durationSec[2][0] = UNREACHABLE_SEC;
    const matrix: PlanMatrix = {
      ...est,
      method: 'route',
      provider: 'Geoapify',
      warning: null,
      missing: [
        [0, 2],
        [2, 0],
      ],
    };
    const routing = {
      travelMatrix: jest.fn().mockResolvedValue(matrix),
    } as unknown as RoutingService;
    const plan = await new DispatchService(prisma, routing).plan({
      date: '2026-11-20',
    });
    expect(plan.routes.flatMap((r) => r.stops.map((s) => s.key))).toEqual([
      'ENTREGA-1',
    ]);
    expect(plan.skipped[0]).toMatchObject({
      rentalId: 2,
      reason: expect.stringMatching(/No hay ruta por calle/),
    });
  });

  it('informa de dónde salieron los tiempos y si el plan es el mejor posible', async () => {
    const { prisma } = fakeDb([
      rental({ id: 1 }),
      rental({ id: 2 }),
      rental({ id: 3 }),
    ]);
    const plan = await new DispatchService(prisma, routingEstimate()).plan({
      date: '2026-11-20',
    });
    expect(plan.matrix).toMatchObject({ method: 'estimate', provider: null });
    expect(plan.matrix.warning).toMatch(/aproximados/);
    expect(plan.solver).toMatchObject({ optimal: true, method: 'exact' });
    expect(plan.warnings[0]).toMatch(/aproximados/);
  });
});

describe('DispatchService: guardar, reabrir y marcar el avance', () => {
  const build = () => {
    const f = fakeDb([rental({ id: 1 }), rental({ id: 2 }), rental({ id: 3 })]);
    return { ...f, svc: new DispatchService(f.prisma, routingEstimate()) };
  };

  it('guarda la ruta con un id por parada y se puede reabrir idéntica', async () => {
    const { svc, db } = build();
    const plan = await svc.plan({ date: '2026-11-20', save: true });
    expect(plan.saved?.runId).toBeGreaterThan(0);
    const ids = plan.routes.flatMap((r) => r.stops.map((s) => s.stopId));
    expect(ids.every((id) => typeof id === 'number')).toBe(true);
    expect(db.stops).toHaveLength(3);

    const reopened = (await svc.getRun('2026-11-20'))!;
    expect(reopened.saved?.runId).toBe(plan.saved!.runId);
    expect(reopened.routes.map((r) => r.stops.map((s) => s.key))).toEqual(
      plan.routes.map((r) => r.stops.map((s) => s.key)),
    );
    expect(reopened.routes[0].stops.map((s) => s.arrive)).toEqual(
      plan.routes[0].stops.map((s) => s.arrive),
    );
    expect(reopened.routes[0]).toMatchObject({
      endTime: plan.routes[0].endTime,
      travelMin: plan.routes[0].travelMin,
      km: plan.routes[0].km,
    });
    expect(reopened.totals.finishTime).toBe(plan.totals.finishTime);
    expect(reopened.matrix.method).toBe('estimate');
  });

  it('sin guardar no queda nada en la base', async () => {
    const { svc, db } = build();
    await svc.plan({ date: '2026-11-20' });
    expect(db.runs).toHaveLength(0);
    expect(await svc.getRun('2026-11-20')).toBeNull();
  });

  it('volver a guardar reemplaza la ruta anterior (queda una sola por día)', async () => {
    const { svc, db } = build();
    await svc.plan({ date: '2026-11-20', save: true });
    await svc.plan({ date: '2026-11-20', save: true, vehicles: 2 });
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0].vehicles).toBe(2);
    expect(db.stops).toHaveLength(3);
  });

  it('llegué / listo / deshacer guardan la hora real', async () => {
    const { svc } = build();
    const plan = await svc.plan({ date: '2026-11-20', save: true });
    const id = plan.routes[0].stops[0].stopId!;
    const arrived = await svc.updateStop(id, 'arrive');
    expect(arrived.arrivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(arrived.completedAt).toBeNull();
    const done = await svc.updateStop(id, 'complete');
    expect(done.arrivedAt).toBe(arrived.arrivedAt); // no pisa la hora de llegada
    expect(done.completedAt).not.toBeNull();
    const reopened = (await svc.getRun('2026-11-20'))!;
    expect(reopened.routes[0].stops[0]).toMatchObject({
      stopId: id,
      completedAt: done.completedAt,
    });
    const reset = await svc.updateStop(id, 'reset');
    expect(reset).toMatchObject({ arrivedAt: null, completedAt: null });
  });

  it('"listo" sin "llegué" también guarda la llegada', async () => {
    const { svc } = build();
    const plan = await svc.plan({ date: '2026-11-20', save: true });
    const r = await svc.updateStop(plan.routes[0].stops[0].stopId!, 'complete');
    expect(r.arrivedAt).not.toBeNull();
  });

  it('una parada que no existe da 404', async () => {
    const { svc } = build();
    await expect(svc.updateStop(999, 'arrive')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('no deja reemplazar una ruta con avance sin confirmar', async () => {
    const { svc } = build();
    const plan = await svc.plan({ date: '2026-11-20', save: true });
    await svc.updateStop(plan.routes[0].stops[0].stopId!, 'arrive');
    await expect(
      svc.plan({ date: '2026-11-20', save: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    const replaced = await svc.plan({
      date: '2026-11-20',
      save: true,
      replace: true,
    });
    expect(replaced.saved).not.toBeNull();
  });

  it('al reabrir avisa de alquileres nuevos y de los que ya no están activos', async () => {
    const { svc, db } = build();
    await svc.plan({ date: '2026-11-20', save: true });
    db.rentals.push(rental({ id: 9, clientName: 'Nuevo' })); // apareció después
    db.rentals.find((r) => r.id === 2)!.status = 'CANCELADO'; // se anuló después
    const reopened = (await svc.getRun('2026-11-20'))!;
    expect(reopened.warnings.join(' ')).toMatch(
      /1 parada nueva que no está en esta ruta.*entrega de Nuevo/,
    );
    expect(reopened.warnings.join(' ')).toMatch(
      /La entrega de Cliente 2 ya no está activa \(anulado\)/,
    );
  });

  it('borrar la ruta del día', async () => {
    const { svc } = build();
    await svc.plan({ date: '2026-11-20', save: true });
    expect(await svc.deleteRun('2026-11-20')).toEqual({ deleted: true });
    expect(await svc.deleteRun('2026-11-20')).toEqual({ deleted: false });
  });
});
