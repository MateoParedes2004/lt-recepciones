import { Controller, Post, Get, Query, Body, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CreateCheckoutIntentDto } from './dto/create-checkout-intent.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Público: se llama en cada visita al sitio para registrar la estadística
  @Post('visita')
  async registrarVisita() {
    return this.analyticsService.registrarVisita();
  }

  // Público: se llama cuando el cliente aprieta "Enviar pedido por WhatsApp"
  // en el carrito. Es la única señal de intención de compra real que existe,
  // porque el checkout público no pasa por el backend.
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
    @Query('year') year: string,
    @Query('month') month?: string,
    @Query('day') day?: string,
  ) {
    return this.analyticsService.getDashboardData(
      Number(year),
      month ? Number(month) : undefined,
      day ? Number(day) : undefined,
    );
  }
}
