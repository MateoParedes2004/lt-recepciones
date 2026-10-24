import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { quoteShipping, ShippingFormula } from './shipping-price';
import { ShippingSettingsService } from './shipping-settings.service';

@Injectable()
export class CitiesService {
  constructor(
    private prisma: PrismaService,
    private shipping: ShippingSettingsService,
  ) {}

  /**
   * Todas las ciudades (activas e inactivas) en orden alfabético. Lo usan el
   * carrito público y el panel.
   *
   * `freeShipping` distingue los dos significados de price = 0: "envío
   * gratis" (dentro del radio gratuito de la fórmula) y "a coordinar".
   */
  async getCities() {
    const [cities, formula] = await Promise.all([
      this.prisma.city.findMany({ orderBy: { name: 'asc' } }),
      this.shipping.getFormula(),
    ]);
    return cities.map((c) => ({
      ...c,
      freeShipping:
        c.priceFromFormula &&
        c.distanceKm !== null &&
        quoteShipping(c.distanceKm, formula).kind === 'free',
    }));
  }

  async createCity(data: CreateCityDto) {
    this.rejectPriceWithFormula(data);
    const distanceKm = data.distanceKm ?? null;
    const priceFromFormula = data.priceFromFormula ?? false;
    return this.prisma.city.create({
      data: {
        name: data.name,
        isActive: data.isActive,
        distanceKm,
        priceFromFormula,
        price: priceFromFormula
          ? this.formulaPrice(distanceKm, await this.shipping.getFormula())
          : (data.price ?? 0),
      },
    });
  }

  /**
   * Editar el precio a mano saca a la ciudad de la fórmula (salvo que en el
   * mismo pedido se pida explícitamente priceFromFormula: true); cambiar los
   * km de una ciudad que usa la fórmula le recalcula el precio.
   */
  async updateCity(id: number, data: UpdateCityDto) {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) {
      throw new NotFoundException(`La ciudad con ID ${id} no existe.`);
    }

    this.rejectPriceWithFormula(data);
    const distanceKm =
      data.distanceKm !== undefined ? data.distanceKm : city.distanceKm;
    const priceFromFormula =
      data.priceFromFormula ??
      (data.price !== undefined ? false : city.priceFromFormula);

    return this.prisma.city.update({
      where: { id },
      data: {
        name: data.name,
        isActive: data.isActive,
        distanceKm,
        priceFromFormula,
        price: priceFromFormula
          ? this.formulaPrice(distanceKm, await this.shipping.getFormula())
          : data.price,
      },
    });
  }

  /**
   * Pasa las ciudades indicadas a "precio por fórmula" y les calcula el
   * precio. Las que no tienen km cargados se saltean (se informan).
   */
  async applyFormula(ids: number[]) {
    return this.prisma.$transaction(async (tx) => {
      const formula = await this.shipping.getFormula(tx);
      const cities = await tx.city.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, distanceKm: true },
      });
      const skipped = cities.filter((c) => c.distanceKm === null);
      const rows = cities
        .filter((c) => c.distanceKm !== null)
        .map((c) => ({
          id: c.id,
          price: quoteShipping(c.distanceKm!, formula).price,
        }));
      await this.shipping.setFormulaPrices(tx, rows);
      return { applied: rows.length, skipped: skipped.map((c) => c.name) };
    });
  }

  async deleteCity(id: number) {
    const city = await this.prisma.city.findUnique({ where: { id } });

    if (!city) {
      throw new NotFoundException(
        `No se puede eliminar: La ciudad con ID ${id} no existe.`,
      );
    }

    // La relación Rental.city es onDelete: SetNull — sin este chequeo, borrar
    // una ciudad con historial dejaba en silencio sin ciudad a todos los
    // alquileres (activos o pasados) que la tenían asignada, y de paso
    // distorsionaba retroactivamente "Demanda por Ciudad" en las estadísticas.
    // Desactivarla (isActive=false) ya la saca del selector sin perder nada:
    // el borrado de verdad solo tiene sentido para una ciudad que nunca se usó.
    const rentalCount = await this.prisma.rental.count({
      where: { cityId: id },
    });
    if (rentalCount > 0) {
      throw new ConflictException(
        `No se puede eliminar "${city.name}": tiene ${rentalCount} alquiler(es) asociado(s) (activos o pasados) que perderían de qué ciudad eran. Desactivala en vez de borrarla para sacarla del selector sin perder el historial.`,
      );
    }

    return this.prisma.city.delete({ where: { id } });
  }

  /** Un precio a mano y "calcular con la fórmula" a la vez: uno pisaría al otro en silencio. */
  private rejectPriceWithFormula(data: {
    price?: number;
    priceFromFormula?: boolean;
  }) {
    if (data.price !== undefined && data.priceFromFormula === true) {
      throw new BadRequestException(
        'Mandá el precio a mano o priceFromFormula: true, no los dos a la vez.',
      );
    }
  }

  private formulaPrice(distanceKm: number | null, formula: ShippingFormula) {
    if (distanceKm === null) {
      throw new BadRequestException(
        'Para calcular el envío con la fórmula, primero cargá los km de la ciudad.',
      );
    }
    return quoteShipping(distanceKm, formula).price;
  }
}
