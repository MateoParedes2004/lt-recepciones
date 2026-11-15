import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { DispatchService } from './dispatch.service';
import { PlanDayDto } from './dto/plan-day.dto';
import { UpdateStopDto } from './dto/update-stop.dto';

@UseGuards(JwtAuthGuard)
@Controller('routing')
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  // Plan de reparto de un día (POST /routing/plan). Cada llamada consume
  // créditos del servicio de rutas (la matriz se reutiliza 6 h) y ~1 s de
  // cálculo: límite propio.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('plan')
  @HttpCode(200)
  plan(@Body() dto: PlanDayDto) {
    return this.dispatch.plan(dto);
  }

  // Ruta guardada de un día (GET /routing/runs/2026-11-20): null si no hay.
  @Get('runs/:date')
  async run(@Param('date') date: string) {
    return (await this.dispatch.getRun(date)) ?? { run: null };
  }

  @Delete('runs/:date')
  deleteRun(@Param('date') date: string) {
    return this.dispatch.deleteRun(date);
  }

  // Marcar el avance de una parada: llegué / listo / deshacer.
  @Patch('stops/:id')
  updateStop(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStopDto,
  ) {
    return this.dispatch.updateStop(id, dto.action);
  }
}
