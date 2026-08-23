import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.category.create({ data });
  }

  // Categorías por ID (orden original), Productos de la A a la Z
  findAll() {
    return this.prisma.category.findMany({
      orderBy: {
        id: 'asc', // AQUÍ ESTÁ EL CAMBIO: Volvemos a ordenar por ID
      },
      include: {
        products: {
          orderBy: {
            name: 'asc', // Los platos y copas siguen ordenados alfabéticamente
          },
        },
      },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: {
            name: 'asc', // También ordenamos los productos al ver una sola categoría
          },
        },
      }
    });
    if (!category) throw new NotFoundException(`La categoría con ID ${id} no existe.`);
    return category;
  }

  update(id: number, data: any) {
    return this.prisma.category.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.category.delete({ where: { id } });
  }
}