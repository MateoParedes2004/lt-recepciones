import { Module } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { GalleryController } from './gallery.controller';
import { PrismaModule } from '../prisma/prisma.module'; // Ajusta la ruta si tu PrismaModule está en otro lado

@Module({
  imports: [PrismaModule],
  controllers: [GalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}