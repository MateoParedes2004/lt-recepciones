import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutIntentDto } from './dto/create-checkout-intent.dto';
import { paraguayToUtc, paraguayTodayUtc, utcToParaguayDate } from '../common/timezone';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // 1. RUTA PARA REGISTRAR VISITAS
  async registrarVisita() {
    // "Hoy" según el calendario de Paraguay, no el reloj del servidor (que en
    // Render corre en UTC) — si no, las visitas nocturnas quedan contadas en
    // el día siguiente. Ver src/common/timezone.ts.
    const hoy = paraguayTodayUtc();

    const visita = await this.prisma.siteVisit.upsert({
      where: { date: hoy },
      update: { count: { increment: 1 } },
      create: { date: hoy, count: 1 },
    });
    return { success: true, visita };
  }

  // 2. INTENCIÓN DE COMPRA (click en "Enviar pedido por WhatsApp")
  async registrarCheckoutIntent(dto: CreateCheckoutIntentDto) {
    const intent = await this.prisma.checkoutIntent.create({
      data: {
        totalAmount: dto.totalAmount,
        itemCount: dto.itemCount,
        cityName: dto.cityName,
      },
    });
    return { success: true, intent };
  }

  // 3. RANGO REAL DE AÑOS CON DATOS (para el selector del panel)
  async getAvailableYears() {
    const currentYear = utcToParaguayDate(new Date()).year;

    const [oldest, newest] = await Promise.all([
      this.prisma.rental.findFirst({ orderBy: { eventDate: 'asc' }, select: { eventDate: true } }),
      this.prisma.rental.findFirst({ orderBy: { eventDate: 'desc' }, select: { eventDate: true } }),
    ]);

    // eventDate es una fecha de calendario pura (guardada como medianoche
    // UTC, ver nota en getDashboardData) — se lee con getters UTC, nunca
    // ajustada por huso horario.
    const minYear = oldest ? Math.min(oldest.eventDate.getUTCFullYear(), currentYear) : currentYear;
    const maxYear = newest ? Math.max(newest.eventDate.getUTCFullYear(), currentYear) : currentYear;

    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y--) years.push(y);
    return years;
  }

  // 4. EL MOTOR DE ESTADÍSTICAS
  async getDashboardData(year: number, month?: number, day?: number) {
    // Un período inválido (mes 13, 31 de abril, año 0...) no debe convertirse
    // en fechas "desbordadas" que devuelvan datos de otro período sin avisar.
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Año inválido.');
    }
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
      throw new BadRequestException('Mes inválido: tiene que estar entre 1 y 12.');
    }
    if (day !== undefined) {
      if (month === undefined) throw new BadRequestException('Para consultar un día hay que indicar también el mes.');
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
        throw new BadRequestException(`Día inválido: ese mes tiene ${daysInMonth} días.`);
      }
    }

    // Dos rangos distintos para el mismo período, porque hay dos tipos de
    // fecha en el sistema:
    //
    // - "Calendario" (calStart/calEnd, UTC puro): para Rental.eventDate y
    //   returnDate. Son fechas elegidas en un <input type="date"> y se
    //   guardan como medianoche UTC por convención — NO representan un
    //   instante real, así que nunca se ajustan por huso horario (hacerlo
    //   las correría de fecha).
    // - "Real" (realStart/realEnd, huso horario de Paraguay): para
    //   SiteVisit y CheckoutIntent, que sí son marcas de tiempo de cuándo
    //   pasó algo de verdad. Ver src/common/timezone.ts.
    let calStart: Date, calEnd: Date;
    let realStart: Date, realEnd: Date;

    if (month && day) {
      calStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      calEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      realStart = paraguayToUtc(year, month, day, 0, 0, 0);
      realEnd = paraguayToUtc(year, month, day, 23, 59, 59, 999);
    } else if (month) {
      calStart = new Date(Date.UTC(year, month - 1, 1));
      calEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      const lastDayOfMonth = calEnd.getUTCDate();
      realStart = paraguayToUtc(year, month, 1, 0, 0, 0);
      realEnd = paraguayToUtc(year, month, lastDayOfMonth, 23, 59, 59, 999);
    } else {
      calStart = new Date(Date.UTC(year, 0, 1));
      calEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      realStart = paraguayToUtc(year, 1, 1, 0, 0, 0);
      realEnd = paraguayToUtc(year, 12, 31, 23, 59, 59, 999);
    }

    const [visitas, alquileres, checkoutIntents] = await Promise.all([
      this.prisma.siteVisit.findMany({ where: { date: { gte: realStart, lte: realEnd } } }),
      this.prisma.rental.findMany({
        where: { eventDate: { gte: calStart, lte: calEnd } },
        include: { items: { include: { product: { include: { category: true } } } }, city: true },
      }),
      // Los pedidos de WhatsApp no tienen "fecha de evento", solo el momento
      // en que el cliente los inició — se filtran por createdAt (real).
      this.prisma.checkoutIntent.findMany({ where: { createdAt: { gte: realStart, lte: realEnd } } }),
    ]);

    // --- TOP PRODUCTOS (por ingresos) ---
    const productStats: Record<number, { id: number; nombre: string; alquileres: number; ingresos: number }> = {};
    // --- INGRESOS POR CATEGORÍA ---
    const categoryStats: Record<string, { categoria: string; alquileres: number; ingresos: number }> = {};

    alquileres.forEach((rental) => {
      rental.items.forEach((item) => {
        if (!item.product) return; // Por si el producto fue borrado

        const precioUnitario = Number(item.unitPrice ?? item.product.pricePerDay);
        const ingresoItem = item.quantity * precioUnitario;

        if (!productStats[item.productId]) {
          productStats[item.productId] = { id: item.productId, nombre: item.product.name, alquileres: 0, ingresos: 0 };
        }
        productStats[item.productId].alquileres += item.quantity;
        productStats[item.productId].ingresos += ingresoItem;

        const categoria = item.product.category?.name ?? 'Sin categoría';
        if (!categoryStats[categoria]) {
          categoryStats[categoria] = { categoria, alquileres: 0, ingresos: 0 };
        }
        categoryStats[categoria].alquileres += item.quantity;
        categoryStats[categoria].ingresos += ingresoItem;
      });
    });

    const topProductos = Object.values(productStats)
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 4);

    const ingresosPorCategoria = Object.values(categoryStats).sort((a, b) => b.ingresos - a.ingresos);

    // --- DEMANDA POR CIUDAD ---
    const cityStats: Record<string, { ciudad: string; alquileres: number; ingresos: number }> = {};
    alquileres.forEach((rental) => {
      const ciudad = rental.city?.name ?? 'Sin especificar';
      if (!cityStats[ciudad]) cityStats[ciudad] = { ciudad, alquileres: 0, ingresos: 0 };
      cityStats[ciudad].alquileres += 1;
      cityStats[ciudad].ingresos += Number(rental.totalPrice);
    });
    const demandaPorCiudad = Object.values(cityStats).sort((a, b) => b.ingresos - a.ingresos);

    // --- DATOS PARA LOS GRÁFICOS (buckets de tiempo) ---
    // Misma distinción que arriba: bucketOfCalendarDate lee eventDate con
    // getters UTC (fecha de calendario pura); bucketOfRealDate convierte el
    // instante real al calendario de Paraguay antes de ubicarlo en un bucket.
    type ChartPoint = { name: string; ingresos: number; pedidos: number; visitas: number; pedidosWhatsapp: number };
    let chartData: ChartPoint[] = [];
    let bucketOfCalendarDate: (d: Date) => number;
    let bucketOfRealDate: (d: Date) => number;

    if (month && day) {
      // Un único bucket: el día completo (los gráficos de series no aportan
      // nada con un solo punto — el frontend muestra los KPIs en su lugar).
      chartData = [{ name: `${day} ${MONTH_NAMES[month - 1]} ${year}`, ingresos: 0, pedidos: 0, visitas: 0, pedidosWhatsapp: 0 }];
      bucketOfCalendarDate = () => 0;
      bucketOfRealDate = () => 0;
    } else if (month) {
      const lastDay = calEnd.getUTCDate();
      const getWeek = (d: number) => (d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : 3);
      const mName = MONTH_NAMES[month - 1];

      chartData = [
        { name: `01-07 ${mName}`, ingresos: 0, pedidos: 0, visitas: 0, pedidosWhatsapp: 0 },
        { name: `08-14 ${mName}`, ingresos: 0, pedidos: 0, visitas: 0, pedidosWhatsapp: 0 },
        { name: `15-21 ${mName}`, ingresos: 0, pedidos: 0, visitas: 0, pedidosWhatsapp: 0 },
        { name: `22-${lastDay} ${mName}`, ingresos: 0, pedidos: 0, visitas: 0, pedidosWhatsapp: 0 },
      ];
      bucketOfCalendarDate = (d) => getWeek(d.getUTCDate());
      bucketOfRealDate = (d) => getWeek(utcToParaguayDate(d).day);
    } else {
      chartData = MONTH_NAMES.map((m) => ({ name: `${m} ${year}`, ingresos: 0, pedidos: 0, visitas: 0, pedidosWhatsapp: 0 }));
      bucketOfCalendarDate = (d) => d.getUTCMonth();
      bucketOfRealDate = (d) => utcToParaguayDate(d).month - 1;
    }

    visitas.forEach((v) => { chartData[bucketOfRealDate(v.date)].visitas += v.count; });
    alquileres.forEach((r) => {
      const b = bucketOfCalendarDate(r.eventDate);
      chartData[b].pedidos += 1;
      chartData[b].ingresos += Number(r.totalPrice);
    });
    checkoutIntents.forEach((c) => { chartData[bucketOfRealDate(c.createdAt)].pedidosWhatsapp += 1; });

    // --- KPIs ---
    const totalIngresos = alquileres.reduce((acc, r) => acc + Number(r.totalPrice), 0);
    const totalAlquileres = alquileres.length;
    const totalVisitas = visitas.reduce((acc, v) => acc + v.count, 0);
    const totalPedidosWhatsapp = checkoutIntents.length;
    const alquileresActivos = alquileres.filter((r) => r.status === 'ACTIVO').length;
    const alquileresDevueltos = totalAlquileres - alquileresActivos;

    const duraciones = alquileres.map((r) => (r.returnDate.getTime() - r.eventDate.getTime()) / MS_PER_DAY);
    const anticipaciones = alquileres.map((r) => (r.eventDate.getTime() - r.createdAt.getTime()) / MS_PER_DAY);
    const promedio = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    let picoBucket: { name: string; ingresos: number } | null = null;
    for (const punto of chartData) {
      if (punto.ingresos > 0 && (!picoBucket || punto.ingresos > picoBucket.ingresos)) {
        picoBucket = { name: punto.name, ingresos: punto.ingresos };
      }
    }

    const kpis = {
      totalIngresos,
      ticketPromedio: totalAlquileres ? totalIngresos / totalAlquileres : 0,
      totalAlquileres,
      totalVisitas,
      totalPedidosWhatsapp,
      tasaVisitaPedido: totalVisitas ? (totalPedidosWhatsapp / totalVisitas) * 100 : 0,
      tasaPedidoAlquiler: totalPedidosWhatsapp ? (totalAlquileres / totalPedidosWhatsapp) * 100 : 0,
      duracionPromedioDias: promedio(duraciones),
      anticipacionPromedioDias: promedio(anticipaciones),
      alquileresActivos,
      alquileresDevueltos,
      picoBucket,
    };

    return { kpis, chartData, topProductos, ingresosPorCategoria, demandaPorCiudad };
  }
}
