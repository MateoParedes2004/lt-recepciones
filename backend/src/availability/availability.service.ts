import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatDayIndex, fromDayIndex, paraguayTodayIndex, toDayIndex } from '../common/timezone';

type Db = Prisma.TransactionClient;

/** Días de calendario (inclusive en ambos extremos) durante los que un alquiler ocupa unidades. */
export interface UsageInterval {
  start: number;
  end: number;
  quantity: number;
}

export interface PeakUsage {
  /** Máximo de unidades ocupadas a la vez dentro del rango consultado. */
  peak: number;
  /** Primer día (número de día) en que se alcanza ese máximo, o null si nada se solapa. */
  day: number | null;
}

/**
 * Máximo de unidades ocupadas a la vez dentro de [from, to] (días inclusive).
 *
 * Es un barrido por eventos: cada alquiler suma su cantidad el día que empieza
 * y la resta el día siguiente al que termina. Recorriendo esos cambios en orden
 * se obtiene el pico de uso simultáneo. Importa el PICO y no la suma: dos
 * alquileres de 6 sillas que no coinciden en ningún día usan 6, no 12.
 */
export function peakUsage(intervals: UsageInterval[], from: number, to: number): PeakUsage {
  const deltas = new Map<number, number>();
  for (const { start, end, quantity } of intervals) {
    const s = Math.max(start, from);
    const e = Math.min(end, to);
    if (s > e) continue;
    deltas.set(s, (deltas.get(s) ?? 0) + quantity);
    deltas.set(e + 1, (deltas.get(e + 1) ?? 0) - quantity);
  }

  let current = 0;
  let peak = 0;
  let day: number | null = null;
  for (const d of [...deltas.keys()].sort((a, b) => a - b)) {
    current += deltas.get(d)!;
    if (current > peak) {
      peak = current;
      day = d;
    }
  }
  return { peak, day };
}

export interface ProductStock {
  id: number;
  name: string;
  totalStock: number;
}

// Con estas dos reglas se decide qué días ocupa un alquiler ACTIVO:
//  - Ocupa desde el día del evento hasta el de devolución, ambos inclusive: el
//    día que vuelve la mercadería no se puede volver a prometer (hay que
//    revisarla, limpiarla y reponerla). Es la regla conservadora.
//  - Si ya pasó la fecha de devolución y sigue ACTIVO (atrasado), las unidades
//    siguen físicamente afuera: ocupa hasta hoy como mínimo, hasta que lo
//    marquen como devuelto.
function effectiveEnd(returnDay: number, today: number): number {
  return Math.max(returnDay, today);
}

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  /**
   * Bloquea las filas de esos productos hasta el fin de la transacción. Es lo
   * que hace seguro "mirar cuánto hay libre y después reservar": dos
   * alquileres simultáneos sobre el mismo producto se ponen en fila en vez de
   * verse ambos el mismo stock libre. Siempre en orden de id para no
   * provocar bloqueos cruzados entre transacciones.
   */
  async lockProducts(tx: Db, productIds: number[]): Promise<void> {
    if (productIds.length === 0) return;
    const ids = [...new Set(productIds)].sort((a, b) => a - b);
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
  }

  /** Intervalos de ocupación de los alquileres ACTIVO que tocan [from, to], por producto. */
  private async loadIntervals(
    db: Db,
    productIds: number[],
    from: number,
    to: number,
    excludeRentalId?: number,
  ): Promise<Map<number, UsageInterval[]>> {
    const today = paraguayTodayIndex();
    // Si "hoy" ya está dentro o más allá del inicio del rango, todo alquiler
    // ACTIVO que empiece antes del final del rango sigue ocupando (o está
    // atrasado y ocupa hasta hoy): no se puede filtrar por returnDate.
    const returnFilter = today >= from ? undefined : { gte: fromDayIndex(from) };

    const rows = await db.rentalItem.findMany({
      where: {
        productId: { in: productIds },
        rental: {
          status: 'ACTIVO',
          ...(excludeRentalId !== undefined ? { id: { not: excludeRentalId } } : {}),
          eventDate: { lte: fromDayIndex(to) },
          ...(returnFilter ? { returnDate: returnFilter } : {}),
        },
      },
      select: { productId: true, quantity: true, rental: { select: { eventDate: true, returnDate: true } } },
    });

    const byProduct = new Map<number, UsageInterval[]>();
    for (const row of rows) {
      const list = byProduct.get(row.productId) ?? [];
      list.push({
        start: toDayIndex(row.rental.eventDate),
        end: effectiveEnd(toDayIndex(row.rental.returnDate), today),
        quantity: row.quantity,
      });
      byProduct.set(row.productId, list);
    }
    return byProduct;
  }

  /**
   * Unidades libres de cada producto durante TODO el rango [from, to]
   * (el mínimo que queda libre en cualquier día del rango).
   */
  async freeUnits(
    db: Db,
    products: ProductStock[],
    from: number,
    to: number,
    excludeRentalId?: number,
  ): Promise<Map<number, { free: number; peak: number; peakDay: number | null }>> {
    const intervals = await this.loadIntervals(db, products.map((p) => p.id), from, to, excludeRentalId);
    const result = new Map<number, { free: number; peak: number; peakDay: number | null }>();
    for (const p of products) {
      const { peak, day } = peakUsage(intervals.get(p.id) ?? [], from, to);
      result.set(p.id, { free: Math.max(0, p.totalStock - peak), peak, peakDay: day });
    }
    return result;
  }

  /**
   * Verifica que los productos pedidos entren en el inventario durante las
   * fechas del alquiler y, si no, explica exactamente por qué. Debe llamarse
   * dentro de una transacción que ya bloqueó esos productos (lockProducts).
   */
  async assertCanFit(
    db: Db,
    wanted: Map<number, number>,
    products: ProductStock[],
    eventDate: Date,
    returnDate: Date,
    excludeRentalId?: number,
  ): Promise<void> {
    const today = paraguayTodayIndex();
    const from = toDayIndex(eventDate);
    const returnDay = toDayIndex(returnDate);
    const to = effectiveEnd(returnDay, today);

    const relevant = products.filter((p) => wanted.has(p.id));
    const availability = await this.freeUnits(db, relevant, from, to, excludeRentalId);

    for (const product of relevant) {
      const quantity = wanted.get(product.id)!;
      const { free, peak, peakDay } = availability.get(product.id)!;
      if (quantity <= free) continue;

      const period = from === returnDay ? formatDayIndex(from) : `${formatDayIndex(from)} al ${formatDayIndex(returnDay)}`;
      const overdueNote = to > returnDay ? ' (el rango se extiende hasta hoy porque el alquiler ya está atrasado)' : '';
      const detail = peak > 0 && peakDay !== null
        ? `el ${formatDayIndex(peakDay)} ya hay ${peak} de ${product.totalStock} unidades reservadas por otros alquileres`
        : `el inventario total es de ${product.totalStock} unidades`;
      throw new BadRequestException(
        `No hay suficiente stock de "${product.name}" para ${period}${overdueNote}: se piden ${quantity} y solo hay ${free} libres (${detail}).`,
      );
    }
  }

  /** Mayor cantidad de unidades que los alquileres ACTIVO necesitan a la vez de hoy en adelante. */
  async futurePeak(db: Db, productId: number): Promise<PeakUsage> {
    const today = paraguayTodayIndex();
    const horizon = today + 3650; // 10 años: más allá de cualquier reserva real
    const intervals = await this.loadIntervals(db, [productId], today, horizon);
    return peakUsage(intervals.get(productId) ?? [], today, horizon);
  }

  /**
   * Agrega a cada producto lo que el panel necesita saber "hoy":
   * availableStock (libres hoy) y rentedCount (ocupadas hoy).
   */
  async withAvailability<T extends ProductStock>(products: T[]): Promise<Array<T & { availableStock: number; rentedCount: number }>> {
    if (products.length === 0) return [];
    const today = paraguayTodayIndex();
    const availability = await this.freeUnits(this.prisma, products, today, today);
    return products.map((p) => {
      const { free } = availability.get(p.id)!;
      return { ...p, availableStock: free, rentedCount: Math.max(0, p.totalStock - free) };
    });
  }

  /** Unidades libres de todos los productos activos durante [from, to] (para el carrito y el panel). */
  async availabilityForRange(from: number, to: number, excludeRentalId?: number) {
    const products = await this.prisma.product.findMany({
      where: { isArchived: false },
      select: { id: true, name: true, totalStock: true },
    });
    const availability = await this.freeUnits(this.prisma, products, from, to, excludeRentalId);
    return products.map((p) => ({ id: p.id, stock: p.totalStock, available: availability.get(p.id)!.free }));
  }

  /** Valida y convierte un rango "desde/hasta" recibido por query string. */
  parseRange(fromRaw: string, toRaw: string): { from: number; to: number } {
    const from = toDayIndex(new Date(fromRaw));
    const to = toDayIndex(new Date(toRaw));
    if (Number.isNaN(from) || Number.isNaN(to)) throw new BadRequestException('Fechas inválidas.');
    if (to < from) throw new BadRequestException('La fecha "hasta" no puede ser anterior a la fecha "desde".');
    if (to - from > 366) throw new BadRequestException('El rango no puede superar un año.');
    return { from, to };
  }
}
