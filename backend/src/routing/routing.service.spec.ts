import { BadRequestException } from '@nestjs/common';
import { DEPOT, haversineKm, ROAD_FACTOR, roundKm } from './geo';
import { GeoapifyRouteProvider } from './providers/geoapify.provider';
import type { RouteProvider, TravelMatrix } from './providers/route-provider';
import { UNREACHABLE_SEC, scaleDurations } from './travel-matrix';
import { RoutingService } from './routing.service';

const SALON = { lat: -25.28, lng: -57.63 };

const fakeProvider = (
  impl: RouteProvider['route'],
  matrix: RouteProvider['matrix'] = () =>
    Promise.reject(new Error('sin matriz en esta prueba')),
): RouteProvider => ({
  name: 'Prueba',
  maxMatrixPoints: 31,
  route: impl,
  matrix,
});

const redirect = (location: string | null) =>
  ({
    headers: new Headers(location ? { location } : {}),
    body: null,
  }) as unknown as Response;

describe('RoutingService', () => {
  it('con servicio de rutas: km por calle redondeados a 1 decimal y minutos', async () => {
    const service = new RoutingService(
      fakeProvider(() =>
        Promise.resolve({ distanceMeters: 7449, durationSeconds: 845 }),
      ),
    );
    const result = await service.locate('-25.28, -57.63');
    expect(result).toMatchObject({
      point: SALON,
      distanceKm: 7.4,
      durationMinutes: 14,
      method: 'route',
      provider: 'Prueba',
      warning: null,
    });
    expect(result.origin).toEqual(DEPOT);
  });

  it('mide desde el depósito', async () => {
    const route = jest
      .fn()
      .mockResolvedValue({ distanceMeters: 1000, durationSeconds: null });
    await new RoutingService(fakeProvider(route)).locate('-25.28, -57.63');
    expect(route).toHaveBeenCalledWith(
      { lat: DEPOT.lat, lng: DEPOT.lng, label: DEPOT.label },
      SALON,
    );
  });

  it('si el servicio falla, estima en línea recta y lo avisa (no deja al admin sin km)', async () => {
    const service = new RoutingService(
      fakeProvider(() => Promise.reject(new Error('sin cuota'))),
    );
    const result = await service.locate('-25.28, -57.63');
    expect(result.method).toBe('estimate');
    expect(result.distanceKm).toBe(
      roundKm(haversineKm(DEPOT, SALON) * ROAD_FACTOR),
    );
    expect(result.warning).toMatch(/aproximados/);
  });

  it('sin servicio configurado también estima', async () => {
    const result = await new RoutingService(null).locate('-25.28, -57.63');
    expect(result).toMatchObject({
      method: 'estimate',
      provider: null,
      durationMinutes: null,
    });
  });

  it('corrige latitud y longitud invertidas', async () => {
    const result = await new RoutingService(null).locate('-57.63, -25.28');
    expect(result.point).toEqual(SALON);
  });

  it('rechaza un punto en otro continente (signo menos olvidado)', async () => {
    await expect(
      new RoutingService(null).locate('25.28, 57.63'),
    ).rejects.toThrow(/km del depósito/);
  });

  it('mensajes claros para lo que no es una ubicación', async () => {
    const service = new RoutingService(null);
    await expect(service.locate('Aztecas 877')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.locate('https://www.google.com/maps/place/Salon+X'),
    ).rejects.toThrow(/no trae las coordenadas/);
  });

  it('link corto: sigue las redirecciones hasta encontrar las coordenadas', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(redirect('https://maps.app.goo.gl/otro'))
      .mockResolvedValueOnce(
        redirect('https://www.google.com/maps/place/x/data=!3d-25.28!4d-57.63'),
      );
    const service = new RoutingService(
      null,
      fetchFn as unknown as typeof fetch,
    );
    const result = await service.locate('https://maps.app.goo.gl/AbC');
    expect(result.point).toEqual(SALON);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(init).toMatchObject({ redirect: 'manual' });
  });

  it('link corto: nunca abre sitios que no sean links cortos conocidos', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(redirect('https://sitio-cualquiera.com/algo'));
    const service = new RoutingService(
      null,
      fetchFn as unknown as typeof fetch,
    );
    await expect(service.locate('https://maps.app.goo.gl/AbC')).rejects.toThrow(
      /link corto/,
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('link corto que no se puede abrir (sin red): error claro, no un 500', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const service = new RoutingService(
      null,
      fetchFn as unknown as typeof fetch,
    );
    await expect(
      service.locate('https://maps.app.goo.gl/AbC'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GeoapifyRouteProvider', () => {
  const json = (status: number, body: unknown) =>
    ({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  it('arma el pedido (lat,lon | lat,lon, en auto) y lee distancia y tiempo', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        json(200, { results: [{ distance: 7449, time: 845 }] }),
      );
    const provider = new GeoapifyRouteProvider(
      'CLAVE',
      fetchFn as unknown as typeof fetch,
    );
    await expect(provider.route(DEPOT, SALON)).resolves.toEqual({
      distanceMeters: 7449,
      durationSeconds: 845,
    });
    const [url] = fetchFn.mock.calls[0] as [URL];
    expect(url.origin + url.pathname).toBe(
      'https://api.geoapify.com/v1/routing',
    );
    expect(url.searchParams.get('waypoints')).toBe(
      `${DEPOT.lat},${DEPOT.lng}|${SALON.lat},${SALON.lng}`,
    );
    expect(url.searchParams.get('mode')).toBe('drive');
    expect(url.searchParams.get('format')).toBe('json');
  });

  it('acepta también la respuesta en GeoJSON', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      json(200, {
        features: [{ properties: { distance: 1200, time: 120 } }],
      }),
    );
    const provider = new GeoapifyRouteProvider(
      'CLAVE',
      fetchFn as unknown as typeof fetch,
    );
    await expect(provider.route(DEPOT, SALON)).resolves.toEqual({
      distanceMeters: 1200,
      durationSeconds: 120,
    });
  });

  it('un error no expone la clave', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        json(401, { statusCode: 401, message: 'Invalid apiKey' }),
      );
    const provider = new GeoapifyRouteProvider(
      'CLAVE-SECRETA',
      fetchFn as unknown as typeof fetch,
    );
    const error = await provider.route(DEPOT, SALON).catch((e: Error) => e);
    expect((error as Error).message).toBe(
      'Geoapify respondió 401: Invalid apiKey',
    );
    expect((error as Error).message).not.toContain('CLAVE-SECRETA');
  });

  it('respuesta sin ruta = error (el servicio de rutas estima en su lugar)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, { results: [] }));
    const provider = new GeoapifyRouteProvider(
      'CLAVE',
      fetchFn as unknown as typeof fetch,
    );
    await expect(provider.route(DEPOT, SALON)).rejects.toThrow(/ninguna ruta/);
  });
});

describe('RoutingService.travelMatrix', () => {
  const POINTS = [DEPOT, SALON, { lat: -25.3, lng: -57.55 }];
  const raw = (): TravelMatrix => ({
    durationSec: [
      [0, 600, 900],
      [660, 0, 700],
      [960, 720, 0],
    ],
    distanceM: [
      [0, 5000, 8000],
      [5200, 0, 6000],
      [8300, 6100, 0],
    ],
  });

  it('con servicio: devuelve los tiempos por calle, redondeados, y dice quién los calculó', async () => {
    const service = new RoutingService(
      fakeProvider(
        () => Promise.reject(new Error('x')),
        () => Promise.resolve(raw()),
      ),
    );
    const m = await service.travelMatrix(POINTS);
    expect(m).toMatchObject({
      method: 'route',
      provider: 'Prueba',
      warning: null,
      missing: [],
    });
    expect(m.durationSec[0][1]).toBe(600);
    expect(m.durationSec[1][0]).toBe(660); // la vuelta no cuesta lo mismo (sentidos de calle)
    expect(m.distanceM[2][0]).toBe(8300);
  });

  it('reutiliza la matriz del mismo conjunto de puntos (no gasta créditos al recalcular)', async () => {
    const matrix = jest.fn().mockResolvedValue(raw());
    const service = new RoutingService(
      fakeProvider(() => Promise.reject(new Error('x')), matrix),
    );
    await service.travelMatrix(POINTS);
    await service.travelMatrix(POINTS.map((p) => ({ ...p }))); // mismos puntos, otro arreglo
    expect(matrix).toHaveBeenCalledTimes(1);
    await service.travelMatrix([...POINTS, { lat: -25.2, lng: -57.5 }]); // otro conjunto
    expect(matrix).toHaveBeenCalledTimes(2);
  });

  it('un tramo sin ruta recibe un tiempo enorme y se informa', async () => {
    const data = raw();
    data.durationSec[1][2] = null;
    const service = new RoutingService(
      fakeProvider(
        () => Promise.reject(new Error('x')),
        () => Promise.resolve(data),
      ),
    );
    const m = await service.travelMatrix(POINTS);
    expect(m.missing).toEqual([[1, 2]]);
    expect(m.durationSec[1][2]).toBe(UNREACHABLE_SEC);
    expect(m.distanceM[1][2]).toBeGreaterThan(0); // distancia estimada, no null
  });

  it('si el servicio falla, estima y lo avisa (y no guarda esa estimación en la caché)', async () => {
    const matrix = jest
      .fn()
      .mockRejectedValueOnce(new Error('sin cuota'))
      .mockResolvedValueOnce(raw());
    const service = new RoutingService(
      fakeProvider(() => Promise.reject(new Error('x')), matrix),
    );
    const first = await service.travelMatrix(POINTS);
    expect(first).toMatchObject({ method: 'estimate', provider: null });
    expect(first.warning).toMatch(/aproximados/);
    const second = await service.travelMatrix(POINTS); // reintenta: la estimación no quedó en la caché
    expect(second.method).toBe('route');
  });

  it('sin servicio configurado o con demasiados puntos, estima', async () => {
    expect((await new RoutingService(null).travelMatrix(POINTS)).method).toBe(
      'estimate',
    );
    const many = Array.from({ length: 40 }, (_, i) => ({
      lat: -25.3 + i * 0.001,
      lng: -57.6,
    }));
    const m = await new RoutingService(
      fakeProvider(
        () => Promise.reject(new Error('x')),
        () => Promise.resolve(raw()),
      ),
    ).travelMatrix(many);
    expect(m.method).toBe('estimate');
    expect(m.warning).toMatch(/más de 30 paradas/);
  });

  it('scaleDurations multiplica los tiempos (no las distancias) y respeta los tramos sin ruta', () => {
    const base = {
      durationSec: [
        [0, 600],
        [UNREACHABLE_SEC, 0],
      ],
      distanceM: [
        [0, 5000],
        [5000, 0],
      ],
    };
    const scaled = scaleDurations(base, 1.5);
    expect(scaled.durationSec[0][1]).toBe(900);
    expect(scaled.durationSec[1][0]).toBe(UNREACHABLE_SEC);
    expect(scaled.distanceM).toBe(base.distanceM);
    expect(scaleDurations(base, 1)).toBe(base);
  });
});

describe('GeoapifyRouteProvider.matrix', () => {
  const ok = (rows: unknown) =>
    ({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ sources_to_targets: rows }),
    }) as unknown as Response;

  it('arma el pedido con [lon, lat] y lee tiempos y distancias; null donde no hay ruta', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      ok([
        [
          { time: 0, distance: 0 },
          { time: 600, distance: 5000 },
        ],
        [
          { time: 650, distance: 5100 },
          { time: null, distance: null },
        ],
      ]),
    );
    const provider = new GeoapifyRouteProvider(
      'CLAVE',
      fetchFn as unknown as typeof fetch,
    );
    const m = await provider.matrix([DEPOT, SALON]);
    expect(m.durationSec).toEqual([
      [0, 600],
      [650, null],
    ]);
    expect(m.distanceM[1][0]).toBe(5100);
    const [url, init] = fetchFn.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/v1/routematrix');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as {
      mode: string;
      sources: { location: number[] }[];
    };
    expect(body.mode).toBe('drive');
    expect(body.sources[0].location).toEqual([DEPOT.lng, DEPOT.lat]); // Geoapify espera [longitud, latitud]
  });

  it('rechaza lo que no se puede (pocos o demasiados puntos, respuesta con otro tamaño) sin exponer la clave', async () => {
    const provider = new GeoapifyRouteProvider(
      'CLAVE-SECRETA',
      jest
        .fn()
        .mockResolvedValue(
          ok([[{ time: 1, distance: 1 }]]),
        ) as unknown as typeof fetch,
    );
    await expect(provider.matrix([DEPOT])).rejects.toThrow(/al menos 2 puntos/);
    await expect(
      provider.matrix(Array.from({ length: 32 }, () => DEPOT)),
    ).rejects.toThrow(/hasta 31/);
    await expect(provider.matrix([DEPOT, SALON])).rejects.toThrow(
      /tamaño inesperado/,
    );
    const failing = new GeoapifyRouteProvider(
      'CLAVE-SECRETA',
      jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ message: 'Daily limit' }),
      }) as unknown as typeof fetch,
    );
    const error = await failing.matrix([DEPOT, SALON]).catch((e: Error) => e);
    expect((error as Error).message).toBe(
      'Geoapify respondió 403: Daily limit',
    );
    expect((error as Error).message).not.toContain('CLAVE-SECRETA');
  });
});
