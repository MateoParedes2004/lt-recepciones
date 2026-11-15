import type { GeoPoint } from '../geo';
import type { RouteLeg, RouteProvider, TravelMatrix } from './route-provider';

type FetchFn = typeof fetch;

/**
 * Rutas por calle con Geoapify (datos de OpenStreetMap). El plan gratis da
 * 3.000 créditos por día y no pide tarjeta. Cada cálculo depósito → cliente
 * cuesta 1 crédito; una matriz de n puntos cuesta n × min(n, 10).
 *
 * Condiciones (https://www.geoapify.com/terms-and-conditions/): el plan gratis
 * exige mostrar "Powered by Geoapify" y la atribución a OpenStreetMap (lo hace
 * el panel), y permite uso comercial "en desarrollo y, con algunas
 * limitaciones, en producción" sin detallarlas. Con el volumen de este negocio
 * (decenas de consultas por día) es poco probable que moleste, pero conviene
 * confirmarlo con Geoapify. Los términos no dicen nada sobre guardar los
 * resultados: por eso la matriz solo se guarda en memoria, nunca en la base.
 *
 * Docs: https://apidocs.geoapify.com/docs/routing/ y .../docs/route-matrix/
 */
export class GeoapifyRouteProvider implements RouteProvider {
  readonly name = 'Geoapify';
  /** Una consulta de matriz admite hasta 1.000 celdas: 31 × 31 = 961. */
  readonly maxMatrixPoints = 31;

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
    if (!res.ok) throw await this.failure(res);

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

  async matrix(points: GeoPoint[]): Promise<TravelMatrix> {
    const n = points.length;
    if (n < 2) throw new Error('La matriz necesita al menos 2 puntos.');
    if (n > this.maxMatrixPoints) {
      throw new Error(
        `Geoapify admite hasta ${this.maxMatrixPoints} puntos por consulta (hay ${n}).`,
      );
    }
    const locations = points.map((p) => ({ location: [p.lng, p.lat] })); // Geoapify usa [lon, lat]
    const url = new URL('https://api.geoapify.com/v1/routematrix');
    url.searchParams.set('apiKey', this.apiKey);

    const res = await this.fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'drive',
        sources: locations,
        targets: locations,
      }),
      signal: AbortSignal.timeout(this.timeoutMs * 2),
    });
    if (!res.ok) throw await this.failure(res);

    const body = (await res.json()) as {
      sources_to_targets?: {
        time?: unknown;
        distance?: unknown;
        source_index?: unknown;
        target_index?: unknown;
      }[][];
    };
    const rows = body.sources_to_targets;
    if (!Array.isArray(rows) || rows.length !== n) {
      throw new Error('Geoapify devolvió una matriz con un tamaño inesperado.');
    }
    const number = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
    const durationSec: (number | null)[][] = [];
    const distanceM: (number | null)[][] = [];
    for (let i = 0; i < n; i++) {
      const row = rows[i];
      if (!Array.isArray(row) || row.length !== n) {
        throw new Error('Geoapify devolvió una fila con un tamaño inesperado.');
      }
      durationSec.push(row.map((cell) => number(cell?.time)));
      distanceM.push(row.map((cell) => number(cell?.distance)));
    }
    return { durationSec, distanceM };
  }

  /** Error con el motivo que da Geoapify, sin la clave. */
  private async failure(res: Response): Promise<Error> {
    const detail = await res.json().then(
      (b: { message?: string }) => b?.message,
      () => undefined,
    );
    return new Error(
      `Geoapify respondió ${res.status}${detail ? `: ${detail}` : ''}`,
    );
  }
}
