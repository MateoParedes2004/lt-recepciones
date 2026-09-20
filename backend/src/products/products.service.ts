import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AvailabilityService } from '../availability/availability.service';
import { formatDayIndex } from '../common/timezone';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private cloudinaryService: CloudinaryService,
    private availability: AvailabilityService,
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

    const products = await this.prisma.product.findMany({
      where: { isArchived: false },
      include: {
        category: true,
      },
      orderBy: {
        id: 'desc',
      },
      ...pagination,
    });
    // totalStock = inventario físico; availableStock = libres hoy (se calcula, no se guarda).
    return this.availability.withAvailability(products);
  }

  // Solo para el panel admin: los productos dados de baja, para poder verlos y restaurarlos.
  async getArchivedProducts() {
    const products = await this.prisma.product.findMany({
      where: { isArchived: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    return this.availability.withAvailability(products);
  }

  async restoreProduct(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || !product.isArchived) {
      throw new NotFoundException(`No hay ningún producto dado de baja con ID ${id}.`);
    }
    const restored = await this.prisma.product.update({ where: { id }, data: { isArchived: false }, include: { category: true } });
    return (await this.availability.withAvailability([restored]))[0];
  }

  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product || product.isArchived) throw new NotFoundException(`El producto con ID ${id} no existe.`);
    return (await this.availability.withAvailability([product]))[0];
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

    // "Stock Total" es el inventario FÍSICO. Cuántas unidades hay libres en
    // una fecha se calcula desde los alquileres (no se guarda), así que
    // editar este número nunca desincroniza nada; lo único a cuidar es no
    // bajarlo por debajo de lo que las reservas ya necesitan a la vez.
    const stockProvided = data.totalStock !== undefined && data.totalStock !== null && data.totalStock !== '';
    const newTotal = stockProvided ? Number(data.totalStock) : undefined;
    if (newTotal !== undefined) dataToUpdate.totalStock = newTotal;

    // Si se sube una foto nueva, guardamos la URL de la anterior para
    // liberarla en Cloudinary una vez que el reemplazo quedó guardado.
    const previous = data.imageUrl
      ? await this.prisma.product.findUnique({ where: { id }, select: { imageUrl: true } })
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (newTotal !== undefined) {
        // Con el producto bloqueado, ningún alquiler nuevo puede colarse entre
        // la comprobación de abajo y la escritura.
        await this.availability.lockProducts(tx, [id]);
        const exists = await tx.product.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new NotFoundException(`El producto con ID ${id} no existe.`);

        const { peak, day } = await this.availability.futurePeak(tx, id);
        if (newTotal < peak) {
          throw new BadRequestException(
            `No podés bajar el stock total a ${newTotal}: hay alquileres vigentes que necesitan hasta ${peak} unidades a la vez` +
              `${day !== null ? ` (el ${formatDayIndex(day)})` : ''}. Ajustá o anulá esos alquileres primero.`,
          );
        }
      }

      const result = await tx.product.updateMany({ where: { id }, data: dataToUpdate });
      if (result.count === 0) throw new NotFoundException(`El producto con ID ${id} no existe.`);
      return tx.product.findUniqueOrThrow({ where: { id } });
    });

    if (previous?.imageUrl && previous.imageUrl !== updated.imageUrl) {
      await this.cloudinaryService.deleteByUrl(previous.imageUrl);
    }
    return (await this.availability.withAvailability([updated]))[0];
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