import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRentalDto } from './dto/create-rental.dto';

@Injectable()
export class RentalsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateRentalDto) {
    let totalPrice = 0;

    // 1. Verificamos que haya stock suficiente (una sola consulta para todos los productos)
    const productIds = data.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productsById = new Map(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      const product = productsById.get(item.productId);
      if (!product) throw new BadRequestException(`Producto no encontrado`);
      if (product.totalStock < item.quantity) {
         throw new BadRequestException(`No hay suficiente stock para: ${product.name}. Solo quedan ${product.totalStock}`);
      }

      // SOLUCIÓN AL ERROR 1: Convertimos el Decimal a Número estándar para poder multiplicar
      totalPrice += (Number(product.pricePerDay) * item.quantity);
    }

    // 2. Creamos el recibo y descontamos el stock al mismo tiempo
    return this.prisma.$transaction(async (prisma) => {
      const rental = await prisma.rental.create({
        data: {
          clientName: data.clientName,
          clientPhone: data.clientPhone || '',
          eventDate: new Date(data.eventDate),
          returnDate: new Date(data.returnDate),
          totalPrice: totalPrice,
          items: {
            create: data.items.map((item: any) => ({
              quantity: item.quantity,
              productId: item.productId
            }))
          }
        }
      });

      // 3. Restamos de "Stock Total" y sumamos a "En Uso"
      for (const item of data.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            totalStock: { decrement: item.quantity },
            rentedCount: { increment: item.quantity }
          }
        });
      }
      return rental;
    });
  }

  // page/limit son opcionales: si no se pasan, se devuelve el historial completo
  // (así lo consume hoy el dashboard admin para sus totales). Si se pasan, se
  // pagina — para cuando el panel incorpore una vista paginada del historial.
  findAll(page?: number, limit?: number) {
    const pagination: { skip?: number; take?: number } = limit
      ? { skip: ((page ?? 1) - 1) * Math.min(limit, 100), take: Math.min(limit, 100) }
      : {};

    return this.prisma.rental.findMany({
      include: {
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' },
      ...pagination,
    });
  }

  async markAsReturned(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      const rental = await prisma.rental.findUnique({
        where: { id }, include: { items: true }
      });

      if (!rental || rental.status === 'DEVUELTO') return rental;

      // Cambiamos el estado a DEVUELTO
      const updatedRental = await prisma.rental.update({
        where: { id }, data: { status: 'DEVUELTO' }
      });

      // Devolvemos las unidades al depósito físico
      for (const item of rental.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            totalStock: { increment: item.quantity },
            rentedCount: { decrement: item.quantity }
          }
        });
      }
      return updatedRental;
    });
  }
}