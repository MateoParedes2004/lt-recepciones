import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRentalDto } from './dto/create-rental.dto';

@Injectable()
export class RentalsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateRentalDto) {
    // Mismas reglas que valida el formulario del panel, pero acá también: la
    // API no puede depender de que el cliente que la llama haya validado.
    const eventDate = new Date(data.eventDate);
    const returnDate = new Date(data.returnDate);
    if (returnDate < eventDate) {
      throw new BadRequestException('La fecha de devolución no puede ser anterior a la fecha del evento.');
    }

    if (data.cityId != null) {
      const city = await this.prisma.city.findUnique({ where: { id: data.cityId }, select: { id: true } });
      if (!city) throw new BadRequestException('La ciudad de entrega seleccionada no existe.');
    }

    // Agregamos cantidades por producto ANTES de validar: si el mismo
    // producto aparece en más de una línea del formulario (dos filas
    // apuntando al mismo artículo), se valida y se descuenta UNA sola vez
    // con el total combinado. Validar línea por línea contra el stock sin
    // descontar entre medio permitía que dos líneas, cada una por debajo
    // del stock disponible, lo dejaran en negativo al sumarse.
    const quantityByProduct = new Map<number, number>();
    for (const item of data.items) {
      quantityByProduct.set(item.productId, (quantityByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: [...quantityByProduct.keys()] } },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    let totalPrice = 0;
    for (const [productId, quantity] of quantityByProduct) {
      const product = productsById.get(productId);
      // Un producto dado de baja ya no se ofrece ni en el catálogo ni en el
      // selector del panel: tampoco debe poder alquilarse llamando a la API.
      if (!product || product.isArchived) throw new BadRequestException(`Producto no encontrado o dado de baja (ID ${productId}).`);
      if (product.totalStock < quantity) {
        throw new BadRequestException(`No hay suficiente stock para: ${product.name}. Solo quedan ${product.totalStock}`);
      }
      // SOLUCIÓN AL ERROR 1: Convertimos el Decimal a Número estándar para poder multiplicar
      totalPrice += Number(product.pricePerDay) * quantity;
    }

    // Creamos el recibo y descontamos el stock al mismo tiempo
    return this.prisma.$transaction(async (prisma) => {
      const rental = await prisma.rental.create({
        data: {
          clientName: data.clientName,
          clientPhone: data.clientPhone || '',
          eventDate,
          returnDate,
          totalPrice: totalPrice,
          cityId: data.cityId ?? null,
          items: {
            create: data.items.map((item) => ({
              quantity: item.quantity,
              productId: item.productId,
              unitPrice: productsById.get(item.productId)!.pricePerDay,
            }))
          }
        }
      });

      // Descuento atómico por producto: el WHERE totalStock >= cantidad hace
      // que la validación y la resta ocurran en una sola sentencia SQL. Si
      // otro alquiler concurrente ya dejó el stock por debajo entre que
      // validamos arriba y llegamos acá, updateMany no afecta ninguna fila y
      // abortamos toda la transacción (el rental recién creado se revierte
      // también) en vez de dejar el stock en negativo en silencio.
      for (const [productId, quantity] of quantityByProduct) {
        const result = await prisma.product.updateMany({
          where: { id: productId, totalStock: { gte: quantity } },
          data: {
            totalStock: { decrement: quantity },
            rentedCount: { increment: quantity }
          }
        });
        if (result.count === 0) {
          const product = productsById.get(productId)!;
          throw new BadRequestException(
            `No hay suficiente stock para: ${product.name}. Alguien más lo alquiló justo ahora — intentá de nuevo.`,
          );
        }
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
        items: { include: { product: true } },
        city: true,
      },
      orderBy: { createdAt: 'desc' },
      ...pagination,
    });
  }

  async markAsReturned(id: number) {
    return this.prisma.$transaction(async (prisma) => {
      // Igual que en create(): actualización atómica condicionada al estado
      // actual. Si dos clicks en "Marcar Devuelto" llegan casi juntos, sólo
      // el primero encuentra la fila en ACTIVO y la cambia; el segundo no
      // afecta ninguna fila y no vuelve a sumar el stock por duplicado.
      const updateResult = await prisma.rental.updateMany({
        where: { id, status: 'ACTIVO' },
        data: { status: 'DEVUELTO' },
      });

      if (updateResult.count === 0) {
        // O no existe, o ya estaba devuelto — en ningún caso hay stock que tocar.
        const existing = await prisma.rental.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`El alquiler con ID ${id} no existe.`);
        return existing;
      }

      const rental = await prisma.rental.findUnique({ where: { id }, include: { items: true } });
      if (!rental) throw new NotFoundException(`El alquiler con ID ${id} no existe.`);

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
      return rental;
    });
  }
}