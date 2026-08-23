import { Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Público: se llama en cada visita al sitio para registrar la estadística
  @Post('visita')
  async registrarVisita() {
    return this.analyticsService.registrarVisita();
  }

  // 👇 RUTA PARA EL PANEL DE ESTADÍSTICAS — solo admin
  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async getDashboard(
    @Query('year') year: string, 
    @Query('month') month?: string
  ) {
    return this.analyticsService.getDashboardData(Number(year), month ? Number(month) : undefined);
  }
}