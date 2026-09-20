import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  create(data: any) {
    return this.prisma.category.create({ data });
  }

  // Categorías por ID (orden original), Productos de la A a la Z.
  // Los productos archivados (baja lógica, ver ProductsService.deleteProduct)
  // nunca aparecen en el catálogo público.
  findAll() {
    return this.prisma.category.findMany({
      orderBy: {
        id: 'asc', // AQUÍ ESTÁ EL CAMBIO: Volvemos a ordenar por ID
      },
      include: {
        products: {
          where: { isArchived: false },
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
          where: { isArchived: false },
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

  async remove(id: number) {
    // Postgres no deja borrar una categoría que todavía tiene productos, pero
    // el error llegaba como un 500 genérico. Lo revisamos antes para explicar
    // qué pasa. Los productos archivados (dados de baja) también cuentan: no
    // se ven en el panel pero siguen apuntando a la categoría.
    const [activos, archivados] = await Promise.all([
      this.prisma.product.count({ where: { categoryId: id, isArchived: false } }),
      this.prisma.product.count({ where: { categoryId: id, isArchived: true } }),
    ]);

    if (activos > 0 || archivados > 0) {
      const partes: string[] = [];
      if (activos > 0) partes.push(`${activos} producto(s) activo(s) (movelos a otra categoría primero)`);
      if (archivados > 0) {
        partes.push(`${archivados} producto(s) dado(s) de baja que conservan su historial de alquileres (restauralos desde Productos → Dados de baja y movelos de categoría)`);
      }
      throw new ConflictException(`No se puede eliminar la categoría: todavía tiene ${partes.join(' y ')}.`);
    }

    return this.prisma.category.delete({ where: { id } });
  }
}