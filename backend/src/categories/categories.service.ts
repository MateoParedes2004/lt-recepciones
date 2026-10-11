import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { prismaErrorCode } from '../common/prisma-error-code';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Un rubro nuevo sin posición va al final (el último número + 10, para dejar
  // lugar a insertar otro entre medio sin renumerar todo).
  async create(data: CreateCategoryDto) {
    const { sortOrder, ...rest } = data;
    const position = sortOrder ?? (await this.nextSortOrder());
    return this.prisma.category.create({ data: { ...rest, sortOrder: position } });
  }

  private async nextSortOrder(): Promise<number> {
    const last = await this.prisma.category.aggregate({ _max: { sortOrder: true } });
    return (last._max.sortOrder ?? 0) + 10;
  }

  // Categorías por posición (sortOrder; a igual posición, por ID), Productos de la A a la Z.
  // Los productos archivados (baja lógica, ver ProductsService.deleteProduct)
  // nunca aparecen en el catálogo público.
  findAll() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
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

  update(id: number, data: UpdateCategoryDto) {
    // null no es una posición válida (la columna no admite nulos): si llega, se ignora.
    const { sortOrder, ...rest } = data;
    const patch = sortOrder === undefined || sortOrder === null ? rest : { ...rest, sortOrder };
    return this.prisma.category.update({ where: { id }, data: patch });
  }

  async remove(id: number) {
    // Postgres ya impide de forma atómica borrar una categoría con productos
    // (activos o archivados) apuntándole: se intenta el borrado directo y,
    // si la clave foránea lo rechaza (P2003), recién ahí se cuenta cuántos
    // productos hay para armar un mensaje claro — en vez de contar antes y
    // borrar después en dos pasos separados, que dejaba una ventana (minúscula,
    // pero real) donde un producto creado justo entre medio se colaba sin que
    // el mensaje de error la hubiera visto.
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (prismaErrorCode(error) === 'P2003') {
        const [activos, archivados] = await Promise.all([
          this.prisma.product.count({ where: { categoryId: id, isArchived: false } }),
          this.prisma.product.count({ where: { categoryId: id, isArchived: true } }),
        ]);
        const partes: string[] = [];
        if (activos > 0) partes.push(`${activos} producto(s) activo(s) (movelos a otra categoría primero)`);
        if (archivados > 0) {
          partes.push(`${archivados} producto(s) dado(s) de baja que conservan su historial de alquileres (restauralos desde Productos → Dados de baja y movelos de categoría)`);
        }
        throw new ConflictException(
          partes.length
            ? `No se puede eliminar la categoría: todavía tiene ${partes.join(' y ')}.`
            : 'No se puede eliminar la categoría: todavía tiene productos asociados.',
        );
      }
      throw error;
    }
  }
}