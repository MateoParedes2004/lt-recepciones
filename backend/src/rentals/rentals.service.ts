import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { paraguayTodayIndex, toDayIndex } from '../common/timezone';
import { CreateRentalDto } from './dto/create-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';

export type RentalPhase = 'RESERVADO' | 'EN_USO' | 'ATRASADO' | 'DEVUELTO' | 'CANCELADO';

const RENTAL_INCLUDE = {
  items: { include: { product: true } },
  city: true,
} satisfies Prisma.RentalInclude;

type RentalItemInput = { productId: number; quantity: number };

/**
 * En qué etapa está un alquiler. No se guarda: se deduce del estado y de las
 * fechas, así nunca queda desactualizado.
 *  - RESERVADO: ACTIVO y todavía no llegó el día del evento.
 *  - EN_USO: ACTIVO y hoy está entre el evento y la devolución.
 *  - ATRASADO: ACTIVO y ya pasó la fecha de devolución (la mercadería no volvió).
 */
export function derivePhase(
  rental: { status: string; eventDate: Date; returnDate: Date },
  today: number = paraguayTodayIndex(),
): { phase: RentalPhase; daysOverdue: number } {
  if (rental.status === 'CANCELADO') return { phase: 'CANCELADO', daysOverdue: 0 };
  if (rental.status === 'DEVUELTO') return { phase: 'DEVUELTO', daysOverdue: 0 };

  const eventDay = toDayIndex(rental.eventDate);
  const returnDay = toDayIndex(rental.returnDate);
  if (today > returnDay) return { phase: 'ATRASADO', daysOverdue: today - returnDay };
  if (today < eventDay) return { phase: 'RESERVADO', daysOverdue: 0 };
  return { phase: 'EN_USO', daysOverdue: 0 };
}

@Injectable()
export class RentalsService {
  constructor(
    private prisma: PrismaService,
    private availability: AvailabilityService,
  ) {}

  // ---------------------------------------------------------------- helpers

  private parseDates(eventRaw: string | Date, returnRaw: string | Date) {
    const eventDate = new Date(eventRaw);
    const returnDate = new Date(returnRaw);
    if (returnDate < eventDate) {
      throw new BadRequestException('La fecha de devolución no puede ser anterior a la fecha del evento.');
    }
    return { eventDate, returnDate };
  }

  private async assertCityExists(cityId: number | null | undefined) {
    if (cityId == null) return;
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) throw new BadRequestException('La ciudad de entrega seleccionada no existe.');
  }

  /** Suma las cantidades por producto: el mismo producto en dos líneas se valida como uno solo. */
  private aggregate(items: RentalItemInput[]): Map<number, number> {
    const byProduct = new Map<number, number>();
    for (const item of items) {
      byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
    }
    return byProduct;
  }

  private withPhase<T extends { status: string; eventDate: Date; returnDate: Date }>(rental: T) {
    return { ...rental, ...derivePhase(rental) };
  }

  private async findOneOrFail(id: number) {
    const rental = await this.prisma.rental.findUnique({ where: { id }, include: RENTAL_INCLUDE });
    if (!rental) throw new NotFoundException(`El alquiler con ID ${id} no existe.`);
    return rental;
  }

  // ----------------------------------------------------------------- crear

  async create(data: CreateRentalDto) {
    const { eventDate, returnDate } = this.parseDates(data.eventDate, data.returnDate);
    await this.assertCityExists(data.cityId);
    const wanted = this.aggregate(data.items);
    const productIds = [...wanted.keys()];

    const rental = await this.prisma.$transaction(
      async (tx) => {
        // Bloqueamos los productos ANTES de mirar la disponibilidad: si otro
        // alquiler sobre los mismos productos se está creando ahora mismo, este
        // espera y ve su resultado. Así nunca se venden dos veces las mismas unidades.
        await this.availability.lockProducts(tx, productIds);

        const products = await tx.product.findMany({ where: { id: { in: productIds } } });
        const byId = new Map(products.map((p) => [p.id, p]));
        for (const productId of productIds) {
          const product = byId.get(productId);
          // Un producto dado de baja ya no se ofrece: tampoco debe poder alquilarse llamando a la API.
          if (!product || product.isArchived) {
            throw new BadRequestException(`Producto no encontrado o dado de baja (ID ${productId}).`);
          }
        }

        await this.availability.assertCanFit(tx, wanted, products, eventDate, returnDate);

        const totalPrice = data.items.reduce((sum, item) => sum + Number(byId.get(item.productId)!.pricePerDay) * item.quantity, 0);

        return tx.rental.create({
          data: {
            clientName: data.clientName,
            clientPhone: data.clientPhone || '',
            eventDate,
            returnDate,
            totalPrice,
            cityId: data.cityId ?? null,
            items: {
              create: data.items.map((item) => ({
                quantity: item.quantity,
                productId: item.productId,
                unitPrice: byId.get(item.productId)!.pricePerDay,
              })),
            },
          },
          include: RENTAL_INCLUDE,
        });
      },
      { timeout: 15000 },
    );

    return this.withPhase(rental);
  }

  // page/limit son opcionales: si no se pasan, se devuelve el historial completo
  // (así lo consume hoy el dashboard admin para sus totales). Si se pasan, se
  // pagina — para cuando el panel incorpore una vista paginada del historial.
  async findAll(page?: number, limit?: number) {
    const pagination: { skip?: number; take?: number } = limit
      ? { skip: ((page ?? 1) - 1) * Math.min(limit, 100), take: Math.min(limit, 100) }
      : {};

    const rentals = await this.prisma.rental.findMany({
      include: RENTAL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      ...pagination,
    });
    const today = paraguayTodayIndex();
    return rentals.map((r) => ({ ...r, ...derivePhase(r, today) }));
  }

  /** Unidades libres por producto en un rango, opcionalmente sin contar un alquiler (el que se está editando). */
  async availabilityForRange(fromRaw: string, toRaw: string, excludeRentalId?: number) {
    const { from, to } = this.availability.parseRange(fromRaw, toRaw);
    return { products: await this.availability.availabilityForRange(from, to, excludeRentalId) };
  }

  // ---------------------------------------------------------------- editar

  async update(id: number, data: UpdateRentalDto) {
    await this.assertCityExists(data.cityId);

    const touchesSchedule = data.eventDate !== undefined || data.returnDate !== undefined || data.items !== undefined;

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.rental.findUnique({ where: { id }, include: { items: true } });
        if (!current) throw new NotFoundException(`El alquiler con ID ${id} no existe.`);

        // Los datos de contacto se pueden corregir siempre; fechas y productos
        // solo mientras el alquiler está vigente (uno devuelto o anulado ya no
        // ocupa unidades: para cambiarlo hay que reabrirlo, y ahí se revisa el stock).
        if (touchesSchedule && current.status !== 'ACTIVO') {
          throw new ConflictException(
            `Este alquiler está ${current.status === 'DEVUELTO' ? 'devuelto' : 'anulado'}: reabrilo para cambiar las fechas o los productos.`,
          );
        }

        const eventDate = data.eventDate !== undefined ? new Date(data.eventDate) : current.eventDate;
        const returnDate = data.returnDate !== undefined ? new Date(data.returnDate) : current.returnDate;
        this.parseDates(eventDate, returnDate);

        const update: Prisma.RentalUpdateInput = {};
        if (data.clientName !== undefined) update.clientName = data.clientName;
        if (data.clientPhone !== undefined) update.clientPhone = data.clientPhone || '';
        if (data.cityId !== undefined) update.city = data.cityId === null ? { disconnect: true } : { connect: { id: data.cityId } };

        if (touchesSchedule) {
          const currentLines: RentalItemInput[] = current.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
          const newLines = data.items ?? currentLines;
          const wanted = this.aggregate(newLines);
          const currentWanted = this.aggregate(currentLines);
          const productIds = [...wanted.keys()];

          const sameDates =
            toDayIndex(eventDate) === toDayIndex(current.eventDate) && toDayIndex(returnDate) === toDayIndex(current.returnDate);
          const sameQuantities =
            wanted.size === currentWanted.size && [...wanted].every(([productId, qty]) => currentWanted.get(productId) === qty);

          await this.availability.lockProducts(tx, productIds);
          const products = await tx.product.findMany({ where: { id: { in: productIds } } });
          const byId = new Map(products.map((p) => [p.id, p]));
          for (const productId of productIds) {
            const product = byId.get(productId);
            // Un producto que ya estaba en el alquiler se puede conservar aunque lo hayan dado de baja después.
            if (!product || (product.isArchived && !currentWanted.has(productId))) {
              throw new BadRequestException(`Producto no encontrado o dado de baja (ID ${productId}).`);
            }
          }

          // Solo se revisa el stock si algo relevante cambió; el propio alquiler
          // no cuenta como ocupación (excludeRentalId) para no chocar consigo mismo.
          if (!sameDates || !sameQuantities) {
            await this.availability.assertCanFit(tx, wanted, products, eventDate, returnDate, id);
          }

          update.eventDate = eventDate;
          update.returnDate = returnDate;

          if (data.items) {
            // Precio histórico: un producto que ya estaba conserva el precio de
            // cuando se alquiló; uno nuevo toma el precio de hoy.
            const historicalPrice = new Map<number, Prisma.Decimal | null>();
            for (const item of current.items) if (!historicalPrice.has(item.productId)) historicalPrice.set(item.productId, item.unitPrice);
            const priceFor = (productId: number) => historicalPrice.get(productId) ?? byId.get(productId)!.pricePerDay;

            update.totalPrice = data.items.reduce((sum, item) => sum + Number(priceFor(item.productId)) * item.quantity, 0);
            update.items = {
              deleteMany: {},
              create: data.items.map((item) => ({ quantity: item.quantity, productId: item.productId, unitPrice: priceFor(item.productId) })),
            };
          }
        }

        return tx.rental.update({ where: { id }, data: update, include: RENTAL_INCLUDE });
      },
      { timeout: 15000 },
    );

    return this.withPhase(updated);
  }

  // ------------------------------------------------- devolver / anular / reabrir
  // Ninguna de estas operaciones toca contadores de stock: como la
  // disponibilidad se calcula desde los alquileres ACTIVO, cambiar el estado
  // alcanza para liberar (o volver a ocupar) las unidades.

  async markAsReturned(id: number) {
    // Actualización atómica condicionada al estado: si dos clics llegan casi
    // juntos, solo el primero encuentra la fila en ACTIVO.
    await this.prisma.rental.updateMany({
      where: { id, status: 'ACTIVO' },
      data: { status: 'DEVUELTO', returnedAt: new Date() },
    });
    // Si no se actualizó nada: o no existe (findOneOrFail da 404) o ya estaba
    // devuelto/anulado (se devuelve tal cual, sin repetir nada).
    return this.withPhase(await this.findOneOrFail(id));
  }

  async cancel(id: number) {
    const result = await this.prisma.rental.updateMany({
      where: { id, status: 'ACTIVO' },
      data: { status: 'CANCELADO', cancelledAt: new Date() },
    });
    if (result.count === 0) {
      const existing = await this.findOneOrFail(id);
      if (existing.status === 'DEVUELTO') {
        throw new ConflictException('Este alquiler ya fue devuelto: no se puede anular. Si lo marcaste por error, reabrilo primero.');
      }
      return this.withPhase(existing); // ya estaba anulado
    }
    return this.withPhase(await this.findOneOrFail(id));
  }

  async reopen(id: number) {
    const reopened = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.rental.findUnique({ where: { id }, include: { items: true } });
        if (!current) throw new NotFoundException(`El alquiler con ID ${id} no existe.`);
        if (current.status === 'ACTIVO') return tx.rental.findUniqueOrThrow({ where: { id }, include: RENTAL_INCLUDE });

        // Al reabrirlo vuelve a ocupar unidades: hay que comprobar que
        // sigan libres, porque desde que se cerró pudo alquilarse ese stock.
        const wanted = this.aggregate(current.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
        const productIds = [...wanted.keys()];
        await this.availability.lockProducts(tx, productIds);
        const products = await tx.product.findMany({ where: { id: { in: productIds } } });
        await this.availability.assertCanFit(tx, wanted, products, current.eventDate, current.returnDate, id);

        return tx.rental.update({
          where: { id },
          data: { status: 'ACTIVO', returnedAt: null, cancelledAt: null },
          include: RENTAL_INCLUDE,
        });
      },
      { timeout: 15000 },
    );
    return this.withPhase(reopened);
  }
}
