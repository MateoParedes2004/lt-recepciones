import { BadRequestException } from '@nestjs/common';
import { DEPOT, haversineKm, ROAD_FACTOR, roundKm } from './geo';
import { GeoapifyRouteProvider } from './providers/geoapify.provider';
import type { RouteProvider } from './providers/route-provider';
import { RoutingService } from './routing.service';

const SALON = { lat: -25.28, lng: -57.63 };

const fakeProvider = (impl: RouteProvider['route']): RouteProvider => ({
  name: 'Prueba',
  route: impl,
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
