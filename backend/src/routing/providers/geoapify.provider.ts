import type { GeoPoint } from '../geo';
import type { RouteLeg, RouteProvider } from './route-provider';

type FetchFn = typeof fetch;

/**
 * Rutas por calle con Geoapify (datos de OpenStreetMap). El plan gratis da
 * 3.000 créditos por día, no pide tarjeta y SÍ permite uso comercial; cada
 * cálculo depósito → cliente cuesta 1 crédito. Pide mostrar "Powered by
 * Geoapify" junto al resultado: lo hace el panel.
 *
 * Docs: https://apidocs.geoapify.com/docs/routing/
 */
export class GeoapifyRouteProvider implements RouteProvider {
  readonly name = 'Geoapify';

  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch,
    private readonly timeoutMs = 10_000,
  ) {}

  async route(from: GeoPoint, to: GeoPoint): Promise<RouteLeg> {
    const url = new URL('https://api.geoapify.com/v1/routing');
    url.searchParams.set(
      'waypoints',
      `${from.lat},${from.lng}|${to.lat},${to.lng}`,
    );
    url.searchParams.set('mode', 'drive');
    url.searchParams.set('format', 'json');
    url.searchParams.set('apiKey', this.apiKey);

    // El link lleva la clave: nunca se incluye en mensajes de error ni en logs.
    const res = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const detail = await res.json().then(
        (b: { message?: string }) => b?.message,
        () => undefined,
      );
      throw new Error(
        `Geoapify respondió ${res.status}${detail ? `: ${detail}` : ''}`,
      );
    }

    const body = (await res.json()) as {
      results?: { distance?: unknown; time?: unknown }[];
      features?: { properties?: { distance?: unknown; time?: unknown } }[];
    };
    // format=json devuelve "results"; se acepta también el GeoJSON por si cambia el formato por defecto.
    const route = body.results?.[0] ?? body.features?.[0]?.properties;
    if (
      !route ||
      typeof route.distance !== 'number' ||
      !Number.isFinite(route.distance)
    ) {
      throw new Error('Geoapify no devolvió ninguna ruta para esos puntos.');
    }
    return {
      distanceMeters: route.distance,
      durationSeconds:
        typeof route.time === 'number' && Number.isFinite(route.time)
          ? route.time
          : null,
    };
  }
}
