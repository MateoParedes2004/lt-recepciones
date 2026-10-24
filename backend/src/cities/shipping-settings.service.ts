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

  /** La fila única; si todavía no existe se crea con los valores por defecto del esquema. */
  get(tx: Tx = this.prisma): Promise<ShippingSettings> {
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
    let changed = 0;
    for (const c of cities) {
      const price = quoteShipping(c.distanceKm!, formula).price;
      if (price === c.price) continue;
      await tx.city.update({ where: { id: c.id }, data: { price } });
      changed++;
    }
    return changed;
  }
}
