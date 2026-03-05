import { Controller, Post, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('visita')
  async registrarVisita() {
    return this.analyticsService.registrarVisita();
  }

  // 👇 NUEVA RUTA PARA EL PANEL DE ESTADÍSTICAS
  @Get('dashboard')
  async getDashboard(
    @Query('year') year: string, 
    @Query('month') month?: string
  ) {
    return this.analyticsService.getDashboardData(Number(year), month ? Number(month) : undefined);
  }
}