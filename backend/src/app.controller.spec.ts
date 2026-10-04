import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController /health', () => {
  it('responde ok si la base contesta', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const controller = new AppController(prisma as unknown as PrismaService);
    await expect(controller.health()).resolves.toEqual({ status: 'ok' });
  });

  it('responde 503 si la base no contesta', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('P1001')),
    };
    const controller = new AppController(prisma as unknown as PrismaService);
    await expect(controller.health()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
