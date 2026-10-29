import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  it('/health responde ok sin consultar la base (no debe despertarla)', () => {
    const prisma = { $queryRaw: jest.fn() };
    const controller = new AppController(prisma as unknown as PrismaService);
    expect(controller.health()).toEqual({ status: 'ok' });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('/health sigue ok aunque la base esté caída', () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('quota')),
    };
    const controller = new AppController(prisma as unknown as PrismaService);
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('/health/db responde ok si la base contesta', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new AppController(prisma as unknown as PrismaService);
    await expect(controller.healthDb()).resolves.toEqual({ status: 'ok' });
  });

  it('/health/db responde 503 si la base no contesta', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('P1001')),
    };
    const controller = new AppController(prisma as unknown as PrismaService);
    await expect(controller.healthDb()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
