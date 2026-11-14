import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { ROUTE_PROVIDER, type RouteProvider } from './providers/route-provider';
import { GeoapifyRouteProvider } from './providers/geoapify.provider';

// Qué servicio calcula las rutas por calle. Sin GEOAPIFY_API_KEY no hay
// ninguno y RoutingService estima en línea recta (avisa en el log al arrancar).
function createRouteProvider(): RouteProvider | null {
  const key = process.env.GEOAPIFY_API_KEY?.trim();
  return key ? new GeoapifyRouteProvider(key) : null;
}

// Exporta RoutingService para que otros módulos (la futura app de recorridos,
// por ejemplo) reutilicen el cálculo de rutas sin duplicarlo.
@Module({
  controllers: [RoutingController],
  providers: [
    RoutingService,
    { provide: ROUTE_PROVIDER, useFactory: createRouteProvider },
  ],
  exports: [RoutingService],
})
export class RoutingModule {}
