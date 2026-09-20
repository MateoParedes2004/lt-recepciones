import { Controller, Post, Get, Query, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { CreateCheckoutIntentDto } from './dto/create-checkout-intent.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Público: se llama en cada visita al sitio para registrar la estadística.
  // Límite propio (más estricto que el global de 100/min): sin esto,
  // cualquiera podía inflar el contador de visitas a pura fuerza bruta y
  // ensuciar las estadísticas que ve el dueño del negocio.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('visita')
  async registrarVisita() {
    return this.analyticsService.registrarVisita();
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
