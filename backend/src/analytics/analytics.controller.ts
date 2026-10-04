import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { CreateCheckoutIntentDto } from './dto/create-checkout-intent.dto';
import { RegisterVisitDto, TrackEventDto } from './dto/track-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Público: se llama una vez por día por navegador para registrar el
  // visitante (con su origen; el dispositivo se deduce del navegador).
  // Límite propio (más estricto que el global de 100/min): sin esto,
  // cualquiera podía inflar el contador de visitas a pura fuerza bruta y
  // ensuciar las estadísticas que ve el dueño del negocio.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('visita')
  async registrarVisita(
    @Body() body: RegisterVisitDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.analyticsService.registrarVisita(body?.source, userAgent);
  }

  // Público: páginas vistas, fichas abiertas, agregados a la cotización,
  // búsquedas, fechas consultadas y toques en WhatsApp. Un visitante que
  // navega rápido genera varios por minuto, por eso el tope es más alto.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('evento')
  @HttpCode(204)
  async registrarEvento(
    @Body() body: TrackEventDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.analyticsService.registrarEvento(body.type, body.key, userAgent);
  }

  // Público: se llama cuando el cliente aprieta "Enviar pedido por WhatsApp"
  // en el carrito. Es la única señal de intención de compra real que existe,
  // porque el checkout público no pasa por el backend. Mismo criterio de
  // límite propio que /visita.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('checkout-intent')
  async registrarCheckoutIntent(@Body() body: CreateCheckoutIntentDto) {
    return this.analyticsService.registrarCheckoutIntent(body);
  }

  // Rango real de años con datos, para poblar el selector de año sin hardcodear
  @UseGuards(JwtAuthGuard)
  @Get('years')
  async getAvailableYears() {
    return this.analyticsService.getAvailableYears();
  }

  // Resumen fijo del tráfico (hoy, ayer, últimos 7 días, mes y año en curso),
  // independiente del filtro del panel — solo admin.
  @UseGuards(JwtAuthGuard)
  @Get('resumen')
  async getResumen() {
    return this.analyticsService.getTrafficSummary();
  }

  // 👇 RUTA PARA EL PANEL DE ESTADÍSTICAS — solo admin
  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async getDashboard(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', new ParseIntPipe({ optional: true })) month?: number,
    @Query('day', new ParseIntPipe({ optional: true })) day?: number,
  ) {
    return this.analyticsService.getDashboardData(year, month, day);
  }
}
