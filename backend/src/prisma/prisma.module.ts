import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // 👈 Esto hace que esté disponible en toda la app
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 👈 ¡CRUCIAL! Esto permite que otros módulos lo usen
})
export class PrismaModule {}