import { Module } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { CitiesController } from './cities.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Importante para que el CitiesService pueda usar Prisma

@Module({
    imports: [PrismaModule], // Asegúrate de importar el módulo de Prisma aquí
    controllers: [CitiesController],
    providers: [CitiesService],
})
export class CitiesModule {}