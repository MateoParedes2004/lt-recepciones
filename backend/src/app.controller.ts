import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';

// GET /health: dice si el servidor y la base de datos responden. Sirve para
// el "Health Check Path" de Render y para un monitor externo (ej. UptimeRobot)
// que lo consulte cada pocos minutos y así el plan gratuito no se duerma.
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @SkipThrottle()
  @Get('health')
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('La base de datos no responde.');
    }
  }
}
