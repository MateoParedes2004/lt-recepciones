import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async createProduct(data: any) {
    return this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        imageUrl: data.imageUrl,
        // CONVERSIÓN FORZADA: Aseguramos que los textos se vuelvan números
        pricePerDay: parseFloat(data.pricePerDay),
        categoryId: Number(data.categoryId),
        totalStock: Number(data.totalStock),
      },
    });
  }

  // page/limit son opcionales: sin ellos se devuelve el catálogo completo
  // (lo necesitan el catálogo público y el selector de productos del admin).
  // Con ellos, se pagina — útil si el listado admin crece mucho.
  // Los productos archivados (ver deleteProduct) nunca aparecen acá.
  async getAllProducts(page?: number, limit?: number) {
    const pagination: { skip?: number; take?: number } = limit
      ? { skip: ((page ?? 1) - 1) * Math.min(limit, 100), take: Math.min(limit, 100) }
      : {};

    return this.prisma.product.findMany({
      where: { isArchived: false },
      include: {
        category: true,
      },
      orderBy: {
        id: 'desc',
      },
      ...pagination,
    });
  }

  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product || product.isArchived) throw new NotFoundException(`El producto con ID ${id} no existe.`);
    return product;
  }

  // 👇 TAMBIÉN BLINDAMOS LA ACTUALIZACIÓN
  async updateProduct(id: number, data: any) {
    // Creamos un objeto limpio solo con los datos que queremos tocar
    const dataToUpdate: any = {
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
    };

    // Solo convertimos si el dato existe (para no romper si editas solo el nombre)
    if (data.pricePerDay) dataToUpdate.pricePerDay = parseFloat(data.pricePerDay);
    if (data.categoryId) dataToUpdate.categoryId = Number(data.categoryId);

    if (data.totalStock !== undefined && data.totalStock !== null && data.totalStock !== '') {
      // El "Stock Total" que edita el admin representa el inventario FÍSICO
      // completo (disponible + alquilado ahora mismo), no solo lo disponible.
      // Si escribiéramos ese número directo en totalStock (disponible),
      // cada edición mientras hay alquileres activos desincronizaría
      // rentedCount y podía inflar el disponible por encima de la flota real.
      const current = await this.prisma.product.findUnique({ where: { id }, select: { rentedCount: true } });
      if (!current) throw new NotFoundException(`El producto con ID ${id} no existe.`);

      const physicalTotal = Number(data.totalStock);
      const newAvailable = physicalTotal - current.rentedCount;
      if (newAvailable < 0) {
        throw new BadRequestException(
          `El stock total no puede ser menor a lo que ya está alquilado (${current.rentedCount} unidades afuera ahora mismo).`,
        );
      }
      dataToUpdate.totalStock = newAvailable;
    }

    return this.prisma.product.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  async deleteProduct(id: number) {
    const hasHistory = await this.prisma.rentalItem.findFirst({ where: { productId: id } });

    if (!hasHistory) {
      // Nunca se alquiló: no hay nada que preservar, se borra de verdad.
      return this.prisma.product.delete({ where: { id } });
    }

    // Tiene alquileres asociados: lo archivamos en vez de borrarlo. Un
    // borrado real se llevaría por delante el detalle de esos alquileres
    // (por la relación RentalItem → Product) y distorsionaría retroactivamente
    // las estadísticas de ingresos de ese producto. Archivado, desaparece del
    // catálogo público y del selector de "Nuevo Alquiler", pero el histórico
    // financiero queda intacto.
    return this.prisma.product.update({ where: { id }, data: { isArchived: true } });
  }
}