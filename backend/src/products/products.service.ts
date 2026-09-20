import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
  ) {}

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

  // Solo para el panel admin: los productos dados de baja, para poder verlos y restaurarlos.
  async getArchivedProducts() {
    return this.prisma.product.findMany({
      where: { isArchived: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async restoreProduct(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || !product.isArchived) {
      throw new NotFoundException(`No hay ningún producto dado de baja con ID ${id}.`);
    }
    return this.prisma.product.update({ where: { id }, data: { isArchived: false }, include: { category: true } });
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

    // Si se edita el stock, la escritura queda condicionada a que rentedCount
    // siga siendo el que leímos (ver más abajo): sin eso, un alquiler o una
    // devolución que entre justo en el medio dejaría el disponible calculado
    // sobre un dato viejo y el inventario desincronizado en silencio.
    let expectedRentedCount: number | undefined;

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
      expectedRentedCount = current.rentedCount;
    }

    // Si se sube una foto nueva, guardamos la URL de la anterior para
    // liberarla en Cloudinary una vez que el reemplazo quedó guardado.
    const previous = data.imageUrl
      ? await this.prisma.product.findUnique({ where: { id }, select: { imageUrl: true } })
      : null;

    const result = await this.prisma.product.updateMany({
      where: expectedRentedCount === undefined ? { id } : { id, rentedCount: expectedRentedCount },
      data: dataToUpdate,
    });

    if (result.count === 0) {
      const exists = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException(`El producto con ID ${id} no existe.`);
      throw new ConflictException(
        'El stock de este producto cambió mientras lo editabas (se registró un alquiler o una devolución). Recargá el panel y volvé a intentar.',
      );
    }

    const updated = await this.prisma.product.findUniqueOrThrow({ where: { id } });

    if (previous?.imageUrl && previous.imageUrl !== updated.imageUrl) {
      await this.cloudinaryService.deleteByUrl(previous.imageUrl);
    }
    return updated;
  }

  async deleteProduct(id: number) {
    const hasHistory = await this.prisma.rentalItem.findFirst({ where: { productId: id } });

    if (!hasHistory) {
      // Nunca se alquiló: no hay nada que preservar, se borra de verdad
      // (y su foto también, para no dejarla huérfana en Cloudinary).
      const deleted = await this.prisma.product.delete({ where: { id } });
      await this.cloudinaryService.deleteByUrl(deleted.imageUrl);
      return deleted;
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