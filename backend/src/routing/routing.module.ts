import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DispatchController } from './dispatch/dispatch.controller';
import { DispatchService } from './dispatch/dispatch.service';
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

// Exporta RoutingService y DispatchService para que otros módulos (la futura
// app de recorridos, por ejemplo) reutilicen el cálculo de rutas y el
// planificador sin duplicarlos.
@Module({
  imports: [PrismaModule],
  controllers: [RoutingController, DispatchController],
  providers: [
    RoutingService,
    DispatchService,
    { provide: ROUTE_PROVIDER, useFactory: createRouteProvider },
  ],
  exports: [RoutingService, DispatchService],
})
export class RoutingModule {}
