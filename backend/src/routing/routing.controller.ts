import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AllowRoles } from '../auth/roles';
import { LocateDto } from './dto/locate.dto';
import { RoutingService } from './routing.service';

@UseGuards(JwtAuthGuard)
@AllowRoles('VENDEDOR')
@Controller('routing')
export class RoutingController {
  constructor(private readonly routing: RoutingService) {}

  // Ubicación de entrega pegada en el alquiler → punto exacto + km por calle
  // desde el depósito (POST /routing/locate). Cada llamada consume cuota del
  // servicio de rutas: límite propio, aparte del general.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('locate')
  @HttpCode(200)
  locate(@Body() dto: LocateDto) {
    return this.routing.locate(dto.input);
  }
}
