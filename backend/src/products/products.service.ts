import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // 👇 AQUÍ ESTABA EL ERROR DE CREACIÓN
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
        // Si tu base de datos tiene el campo isArchived, lo ponemos false
        // Si NO lo tiene (porque no lo agregaste al final), borra esta línea:
        // isArchived: false, 
      },
    });
  }

  // page/limit son opcionales: sin ellos se devuelve el catálogo completo
  // (lo necesitan el catálogo público y el selector de productos del admin).
  // Con ellos, se pagina — útil si el listado admin crece mucho.
  async getAllProducts(page?: number, limit?: number) {
    const pagination: { skip?: number; take?: number } = limit
      ? { skip: ((page ?? 1) - 1) * Math.min(limit, 100), take: Math.min(limit, 100) }
      : {};

    return this.prisma.product.findMany({
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
    if (!product) throw new NotFoundException(`El producto con ID ${id} no existe.`);
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
    if (data.totalStock) dataToUpdate.totalStock = Number(data.totalStock);

    return this.prisma.product.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  // 👇 MANTENEMOS EL BORRADO DESTRUCTOR QUE YA FUNCIONA
  async deleteProduct(id: number) {
    // 1. Borramos historial de alquileres
    await this.prisma.rentalItem.deleteMany({
      where: { productId: id },
    });

    // 2. Borramos el producto
    return this.prisma.product.delete({
      where: { id },
    });
  }
}