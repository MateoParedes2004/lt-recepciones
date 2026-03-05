import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
// 👇 1. Importamos a sus nuevos compañeros de equipo
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  // 👇 2. Los agregamos al arreglo de 'imports'
  imports: [PrismaModule, CloudinaryModule], 
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}