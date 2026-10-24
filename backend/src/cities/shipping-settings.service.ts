import { Injectable } from '@nestjs/common';
import { Prisma, ShippingSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { quoteShipping, ShippingFormula } from './shipping-price';
import { ShippingSettingsDto } from './dto/shipping-settings.dto';

type Tx = Prisma.TransactionClient;

export function toFormula(s: ShippingSettings): ShippingFormula {
  return {
    pricePerKm: s.pricePerKm,
    freeUnderKm: s.freeUnderKm,
    longDistanceFromKm: s.longDistanceFromKm,
    longDistancePricePerKm: s.longDistancePricePerKm,
    maxKm: s.maxKm,
    roundTo: s.roundTo,
  };
}

@Injectable()
export class ShippingSettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * La fila única; si todavía no existe se crea (una sola vez) con los valores
   * por defecto del esquema. Se lee primero con findUnique: un upsert escribe
   * aunque no cambie nada, y GET /cities (público, lo llama cada visita al
   * carrito) pasaría a hacer una escritura por request.
   */
  async get(tx: Tx = this.prisma): Promise<ShippingSettings> {
    const existing = await tx.shippingSettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return tx.shippingSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
  }

  async getFormula(tx: Tx = this.prisma): Promise<ShippingFormula> {
    return toFormula(await this.get(tx));
  }

  /**
   * Guarda la fórmula y recalcula en la misma transacción el precio de todas
   * las ciudades que la usan, para que el carrito nunca muestre una mezcla de
   * precios viejos y nuevos.
   */
  update(dto: ShippingSettingsDto) {
    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.shippingSettings.upsert({
        where: { id: 1 },
        create: { id: 1, ...dto },
        update: dto,
      });
      const recalculated = await this.recalculateFormulaCities(
        tx,
        toFormula(settings),
      );
      return { settings, recalculated };
    });
  }

  /** Devuelve cuántas ciudades cambiaron de precio. */
  async recalculateFormulaCities(
    tx: Tx,
    formula: ShippingFormula,
  ): Promise<number> {
    const cities = await tx.city.findMany({
      where: { priceFromFormula: true, distanceKm: { not: null } },
      select: { id: true, price: true, distanceKm: true },
    });
    const changes = cities
      .map((c) => ({
        id: c.id,
        price: quoteShipping(c.distanceKm!, formula).price,
        current: c.price,
      }))
      .filter((c) => c.price !== c.current);
    await this.setFormulaPrices(tx, changes);
    return changes.length;
  }

  /**
   * Fija el precio de muchas ciudades y las marca "por fórmula" en UNA sola
   * consulta. Hacerlo ciudad por ciudad (250 UPDATE) dentro de la transacción
   * puede pasar los 5 s que Prisma permite y cancelar todo en una base remota.
   */
  async setFormulaPrices(
    tx: Tx,
    rows: { id: number; price: number }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const ids = rows.map((r) => r.id);
    const prices = rows.map((r) => r.price);
    await tx.$executeRaw`
      UPDATE "City" AS c
      SET "price" = d.price, "priceFromFormula" = true, "updatedAt" = now()
      FROM unnest(${ids}::int[], ${prices}::float8[]) AS d(id, price)
      WHERE c."id" = d.id`;
  }
}
