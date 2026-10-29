import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  // GET /health: solo dice que el servidor está vivo. NO toca la base de datos
  // a propósito: es el que se le da al "Health Check Path" de Render y a un
  // monitor externo (ej. UptimeRobot) que lo consulta cada pocos minutos para
  // que el plan gratuito de Render no se duerma. Si además hiciera una consulta
  // a la base, cada ping la despertaría: en los planes gratuitos (Neon) la base
  // se duerme tras 5 minutos sin uso, y con un ping más seguido que eso queda
  // encendida las 24 horas y gasta la cuota mensual de horas de cómputo.
  @SkipThrottle()
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  // GET /health/db: además revisa que la base responda. Dárselo a un monitor
  // aparte con un intervalo largo (30 minutos o más), nunca al de mantener
  // despierto el servidor.
  @SkipThrottle()
  @Get('health/db')
  async healthDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('La base de datos no responde.');
    }
  }
}
