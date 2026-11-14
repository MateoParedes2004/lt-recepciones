import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import {
  DEPOT,
  GeoPoint,
  haversineKm,
  isValidPoint,
  MAX_KM_FROM_DEPOT,
  ROAD_FACTOR,
  roundCoord,
  roundKm,
} from './geo';
import {
  isShortLinkHost,
  parseLocationText,
  pointFromUrl,
  toUrl,
} from './parse-location';
import { ROUTE_PROVIDER, type RouteProvider } from './providers/route-provider';

/** Inyectable para las pruebas: así no hace falta red para probar los links cortos. */
export const ROUTING_FETCH = Symbol('ROUTING_FETCH');

export interface RouteEstimate {
  distanceKm: number;
  durationMinutes: number | null;
  /** 'route' = km por calle reales; 'estimate' = línea recta × ROAD_FACTOR (aproximado). */
  method: 'route' | 'estimate';
  /** Servicio que calculó la ruta (para mostrar su crédito en el panel). */
  provider: string | null;
  /** Por qué los km son aproximados, si lo son. */
  warning: string | null;
}

export interface LocateResult extends RouteEstimate {
  point: GeoPoint;
  origin: GeoPoint & { label: string };
}

const MAX_REDIRECTS = 5;

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(
    @Optional()
    @Inject(ROUTE_PROVIDER)
    private readonly provider: RouteProvider | null,
    @Optional()
    @Inject(ROUTING_FETCH)
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    // Se avisa al arrancar, no recién cuando alguien calcula un envío: así una
    // variable mal cargada en Render se nota enseguida en los logs.
    if (!this.provider) {
      this.logger.warn(
        'Falta GEOAPIFY_API_KEY: los km de envío se van a estimar en línea recta (aproximados) en vez de por calle.',
      );
    }
  }

  /**
   * Lee la ubicación que pegó el admin (link o coordenadas) y calcula los km
   * por calle desde el depósito. El precio lo calcula después el panel con la
   * fórmula de envío, igual que con los km de una ciudad.
   */
  async locate(input: string): Promise<LocateResult> {
    const point = this.plausible(await this.pointFromInput(input));
    const rounded = { lat: roundCoord(point.lat), lng: roundCoord(point.lng) };
    return {
      point: rounded,
      origin: DEPOT,
      ...(await this.distance(DEPOT, rounded)),
    };
  }

  /**
   * Km por calle entre dos puntos. Si el servicio de rutas no está
   * configurado o falla, NO deja al admin sin respuesta: estima con la línea
   * recta y lo marca como aproximado.
   */
  async distance(from: GeoPoint, to: GeoPoint): Promise<RouteEstimate> {
    if (this.provider) {
      try {
        const leg = await this.provider.route(from, to);
        return {
          distanceKm: roundKm(leg.distanceMeters / 1000),
          durationMinutes:
            leg.durationSeconds !== null
              ? Math.max(1, Math.round(leg.durationSeconds / 60))
              : null,
          method: 'route',
          provider: this.provider.name,
          warning: null,
        };
      } catch (error) {
        this.logger.warn(
          `No se pudo calcular la ruta con ${this.provider.name}: ${(error as Error).message}`,
        );
        return this.estimate(
          from,
          to,
          'El servicio de rutas no respondió: los km son aproximados. Podés volver a intentar en un rato.',
        );
      }
    }
    return this.estimate(
      from,
      to,
      'Sin servicio de rutas configurado: los km son aproximados (línea recta × 1,3).',
    );
  }

  private estimate(
    from: GeoPoint,
    to: GeoPoint,
    warning: string,
  ): RouteEstimate {
    return {
      distanceKm: roundKm(haversineKm(from, to) * ROAD_FACTOR),
      durationMinutes: null,
      method: 'estimate',
      provider: null,
      warning,
    };
  }

  private async pointFromInput(input: string): Promise<GeoPoint> {
    const parsed = parseLocationText(input);
    switch (parsed.kind) {
      case 'point':
        return parsed.point;
      case 'short-link': {
        const point = await this.resolveShortLink(parsed.url).catch(
          (error: Error) => {
            this.logger.warn(
              `No se pudo abrir el link corto: ${error.message}`,
            );
            return null;
          },
        );
        if (point) return point;
        throw new BadRequestException(
          'No se pudo leer ese link corto. Abrilo en el navegador y pegá el link largo que queda en la barra de direcciones, o directamente las coordenadas.',
        );
      }
      case 'link-without-coords':
        throw new BadRequestException(
          'Ese link no trae las coordenadas (pasa cuando es solo el nombre de un lugar). Abrilo, tocá el punto exacto en el mapa y copiá las coordenadas que aparecen (ej. -25.312296, -57.601444).',
        );
      default:
        throw new BadRequestException(
          'No se reconoce una ubicación. Pegá el link de Google Maps que te mandó el cliente o las coordenadas (ej. -25.312296, -57.601444).',
        );
    }
  }

  /**
   * Descarta errores de carga típicos: el signo menos olvidado o latitud y
   * longitud invertidas mandan el punto a otro continente. Si invertidas
   * quedan cerca, se corrigen solas; si no, se avisa.
   */
  private plausible(point: GeoPoint): GeoPoint {
    if (haversineKm(DEPOT, point) <= MAX_KM_FROM_DEPOT) return point;
    const swapped = { lat: point.lng, lng: point.lat };
    if (
      isValidPoint(swapped) &&
      haversineKm(DEPOT, swapped) <= MAX_KM_FROM_DEPOT
    )
      return swapped;
    throw new BadRequestException(
      `Esa ubicación queda a ${Math.round(haversineKm(DEPOT, point)).toLocaleString('es-PY')} km del depósito. Revisá que las coordenadas estén completas, con el signo menos (ej. -25.312296, -57.601444).`,
    );
  }

  /**
   * Sigue las redirecciones de un link corto (maps.app.goo.gl/…) hasta
   * encontrar las coordenadas. Solo abre links cortos conocidos: nunca hace
   * pedidos a otros sitios con lo que pegue el usuario.
   */
  private async resolveShortLink(start: string): Promise<GeoPoint | null> {
    let current = toUrl(start);
    for (let hop = 0; current && hop < MAX_REDIRECTS; hop++) {
      if (!isShortLinkHost(current.hostname)) return null;
      const res = await this.fetchFn(current.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(8_000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LT-Recepciones/1.0)',
        },
      });
      await res.body?.cancel().catch(() => undefined);
      const location = res.headers.get('location');
      if (!location) return null;
      const next = toUrl(new URL(location, current).toString());
      if (!next) return null;
      const point = pointFromUrl(next);
      if (point) return point;
      current = next;
    }
    return null;
  }
}
