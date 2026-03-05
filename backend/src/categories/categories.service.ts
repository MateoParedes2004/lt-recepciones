import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.category.create({ data });
  }

  // 🪄 AQUÍ ESTÁ LA MAGIA: Le decimos que al buscar categorías, traiga sus productos
  findAll() {
    return this.prisma.category.findMany({
      include: {
        products: true, 
      },
    });
  }

  findOne(id: number) {
    return this.prisma.category.findUnique({ 
      where: { id },
      include: {
        products: true,
      }
    });
  }

  update(id: number, data: any) {
    return this.prisma.category.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.category.delete({ where: { id } });
  }
}