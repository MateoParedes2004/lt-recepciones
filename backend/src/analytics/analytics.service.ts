import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { derivePhase } from '../rentals/rentals.service';
import { CreateCheckoutIntentDto } from './dto/create-checkout-intent.dto';
import { PublicEventType } from './dto/track-event.dto';
import {
  fromDayIndex,
  paraguayToUtc,
  paraguayTodayIndex,
  paraguayTodayUtc,
  toDayIndex,
  utcToParaguayDate,
} from '../common/timezone';
import { deviceFromUserAgent, isBotUserAgent } from '../common/user-agent';
import { MANTELES_CATEGORY_NAME } from '../common/categories';
import {
  anticipationShare,
  clientKey,
  productOccupancy,
  repeatClients,
  suggestion,
  weekdayShare,
} from './business-metrics';

/**
 * Un pedido por WhatsApp es venta cerrada cuando se cargó como alquiler y ese
 * alquiler está confirmado (activo o ya devuelto). Si quedó como presupuesto,
 * o el alquiler se anuló, todavía/ya no es una venta.
 */
function isClosedSale(intent: {
  status: string;
  rental: { status: string } | null;
}): boolean {
  return (
    intent.status === 'CONFIRMADO' &&
    (intent.rental?.status === 'ACTIVO' || intent.rental?.status === 'DEVUELTO')
  );
}

// Meta de ingresos por mes que el dueño carga en Inicio (AppMeta).
const MONTHLY_GOAL_KEY = 'monthly_goal';

// Botones de WhatsApp que el sitio marca con data-wa (ver AnalyticsTracker).
const WHATSAPP_BUTTONS = [
  'flotante',
  'contacto',
  'rubro',
  'producto',
  'enlace',
];

/** Texto de búsqueda normalizado: minúsculas, sin tildes ni símbolos, espacios simples. */
function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

type Ranked = { key: string; nombre: string; cantidad: number };

const MONTH_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Nombre exacto del rubro de manteles (compartido con el color de los renglones
// de un alquiler: ver common/categories.ts).
const NOMBRE_RUBRO_MANTELES = MANTELES_CATEGORY_NAME;

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /** Suma 1 al contador de hoy de ese tipo/clave (lo crea si no existe). */
  private async bumpMetric(type: string, key = '') {
    const date = paraguayTodayUtc();
    const upsert = () =>
      this.prisma.siteMetric.upsert({
        where: { date_type_key: { date, type, key } },
        update: { count: { increment: 1 } },
        create: { date, type, key, count: 1 },
      });
    try {
      await upsert();
    } catch (error) {
      // Dos pedidos simultáneos pueden intentar crear la misma fila: el
      // segundo choca con la clave única y alcanza con reintentar (ya existe).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await upsert();
      } else {
        throw error;
      }
    }
  }

  // 1. VISITANTE DEL DÍA (una vez por día por navegador)
  async registrarVisita(source?: string, userAgent?: string) {
    // Robots y vistas previas de links no son visitas de personas.
    if (isBotUserAgent(userAgent)) return { success: true, counted: false };

    // "Hoy" según el calendario de Paraguay, no el reloj del servidor (que en
    // Render corre en UTC) — si no, las visitas nocturnas quedan contadas en
    // el día siguiente. Ver src/common/timezone.ts.
    const hoy = paraguayTodayUtc();

    const visita = await this.prisma.siteVisit.upsert({
      where: { date: hoy },
      update: { count: { increment: 1 } },
      create: { date: hoy, count: 1 },
    });
    // De dónde llegó y desde qué dispositivo: se cuentan por visitante del
    // día (no por página), así los porcentajes suman el total de visitas.
    await Promise.all([
      this.bumpMetric('source', source ?? 'directo'),
      this.bumpMetric('device', deviceFromUserAgent(userAgent)),
    ]);
    return { success: true, counted: true, visita };
  }

  // 2. EVENTOS DEL SITIO (páginas vistas, fichas, cotización, búsquedas…)
  // Cada tipo valida su clave: lo que no tiene sentido se descarta en
  // silencio en vez de ensuciar las estadísticas con basura.
  async registrarEvento(
    type: PublicEventType,
    rawKey: string | undefined,
    userAgent?: string,
  ) {
    if (isBotUserAgent(userAgent)) return;
    const key = (rawKey ?? '').trim();

    switch (type) {
      case 'pageview':
        return this.bumpMetric('pageview');

      case 'product_view':
      case 'add_to_cart': {
        if (!/^\d{1,9}$/.test(key)) return;
        const exists = await this.prisma.product.findUnique({
          where: { id: Number(key) },
          select: { id: true },
        });
        if (!exists) return;
        return this.bumpMetric(type, key);
      }

      case 'search':
      case 'search_empty': {
        const term = normalizeSearch(key);
        if (term.length < 2) return;
        return this.bumpMetric(type, term);
      }

      case 'availability_check': {
        // Fecha de evento válida, desde ayer hasta 3 años adelante.
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
        const [y, m, d] = key.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        if (
          date.getUTCFullYear() !== y ||
          date.getUTCMonth() !== m - 1 ||
          date.getUTCDate() !== d
        )
          return;
        const today = paraguayTodayUtc();
        const min = today.getTime() - 2 * MS_PER_DAY;
        const max = today.getTime() + 3 * 366 * MS_PER_DAY;
        if (date.getTime() < min || date.getTime() > max) return;
        return this.bumpMetric(type, key);
      }

      case 'whatsapp_click':
        return this.bumpMetric(
          type,
          WHATSAPP_BUTTONS.includes(key) ? key : 'enlace',
        );
    }
  }

  // 3. INTENCIÓN DE COMPRA (click en "Enviar pedido por WhatsApp")
  async registrarCheckoutIntent(dto: CreateCheckoutIntentDto) {
    // Se guarda el nombre que tenía cada producto en ese momento: si después
    // lo renombran o lo borran, el histórico sigue diciendo qué se pidió.
    const requested = new Map<number, number>();
    for (const item of dto.items ?? []) {
      requested.set(
        item.productId,
        (requested.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const products = requested.size
      ? await this.prisma.product.findMany({
          where: { id: { in: [...requested.keys()] } },
          select: { id: true, name: true },
        })
      : [];

    const parseCalendarDate = (raw?: string): Date | undefined => {
      if (!raw) return undefined;
      const [y, m, d] = raw.split('-').map(Number);
      const parsed = new Date(Date.UTC(y, m - 1, d));
      return parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d ? parsed : undefined;
    };
    let eventDate = parseCalendarDate(dto.eventDate);
    let returnDate = parseCalendarDate(dto.returnDate);
    // Esto nunca pasa desde el carrito real (ya valida ahí antes de mandar),
    // pero el endpoint es público: si alguien manda fechas invertidas a mano,
    // se descartan las dos en vez de perder todo el pedido por eso — los
    // productos y el total siguen siendo datos útiles para el panel.
    if (eventDate && returnDate && returnDate < eventDate) {
      eventDate = undefined;
      returnDate = undefined;
    }
    const orderItems = products.map((p) => ({ productId: p.id, productName: p.name, quantity: requested.get(p.id) ?? 1 }));

    const intent = await this.prisma.checkoutIntent.create({
      data: {
        totalAmount: dto.totalAmount,
        itemCount: dto.itemCount,
        cityName: dto.cityName,
        cityId: dto.cityId,
        eventDate,
        returnDate,
        items: { create: orderItems },
      },
      select: { id: true },
    });

    // No bloquea ni demora la respuesta al carrito: si falla, el pedido ya
    // quedó guardado y va a aparecer igual en "Pedidos por confirmar".
    void this.emailService.notifyNewOrder({
      id: intent.id,
      totalAmount: dto.totalAmount,
      cityName: dto.cityName ?? null,
      eventDate: eventDate ?? null,
      returnDate: returnDate ?? null,
      items: orderItems,
    });

    return { success: true, intent };
  }

  // Pedidos por WhatsApp todavía sin confirmar (ni convertidos en alquiler, ni descartados).
  async getPendingCheckoutIntents() {
    return this.prisma.checkoutIntent.findMany({
      where: { status: 'PENDIENTE' },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // El admin decide que ese pedido no prosperó: deja de aparecer en la lista de pendientes.
  async discardCheckoutIntent(id: number) {
    const result = await this.prisma.checkoutIntent.updateMany({
      where: { id, status: 'PENDIENTE' },
      data: { status: 'DESCARTADO' },
    });
    if (result.count === 0) {
      const exists = await this.prisma.checkoutIntent.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new NotFoundException(`El pedido con ID ${id} no existe.`);
      // Ya estaba confirmado o descartado: no hay nada más que hacer.
    }
    return { success: true };
  }

  // 4. RESUMEN FIJO DEL TRÁFICO (arriba del panel, sin importar el filtro)
  async getTrafficSummary() {
    const today = paraguayTodayUtc(); // medianoche de hoy en Paraguay
    const { year, month } = utcToParaguayDate(new Date());
    const endOfToday = new Date(today.getTime() + MS_PER_DAY - 1);

    const ranges = {
      hoy: { from: today, to: endOfToday },
      ayer: {
        from: new Date(today.getTime() - MS_PER_DAY),
        to: new Date(today.getTime() - 1),
      },
      ultimos7: {
        from: new Date(today.getTime() - 6 * MS_PER_DAY),
        to: endOfToday,
      },
      mes: { from: paraguayToUtc(year, month, 1), to: endOfToday },
      anio: { from: paraguayToUtc(year, 1, 1), to: endOfToday },
    };

    // Una sola lectura del año en curso (y de ayer, por si hoy es 1 de enero)
    // y se reparte en memoria: son a lo sumo unas pocas filas por día.
    const from = new Date(
      Math.min(
        ranges.anio.from.getTime(),
        ranges.ayer.from.getTime(),
        ranges.ultimos7.from.getTime(),
      ),
    );
    const [visits, pageviews] = await Promise.all([
      this.prisma.siteVisit.findMany({
        where: { date: { gte: from, lte: endOfToday } },
        select: { date: true, count: true },
      }),
      this.prisma.siteMetric.findMany({
        where: { type: 'pageview', date: { gte: from, lte: endOfToday } },
        select: { date: true, count: true },
      }),
    ]);

    const sumIn = (
      rows: { date: Date; count: number }[],
      r: { from: Date; to: Date },
    ) =>
      rows.reduce(
        (acc, row) =>
          row.date >= r.from && row.date <= r.to ? acc + row.count : acc,
        0,
      );

    const result = {} as Record<
      keyof typeof ranges,
      { visitantes: number; paginasVistas: number }
    >;
    for (const [name, range] of Object.entries(ranges) as [
      keyof typeof ranges,
      { from: Date; to: Date },
    ][]) {
      result[name] = {
        visitantes: sumIn(visits, range),
        paginasVistas: sumIn(pageviews, range),
      };
    }
    return result;
  }

  // 5. RANGO REAL DE AÑOS CON DATOS (para el selector del panel)
  async getAvailableYears() {
    const currentYear = utcToParaguayDate(new Date()).year;

    // Antes solo miraba Rental.eventDate: un año con visitas pero todavía sin
    // ningún alquiler cargado (ej. recién lanzado el sitio) no aparecía en el
    // selector, aunque hubiera datos reales de tráfico para revisar ese año.
    const [oldestRental, newestRental, oldestVisit, newestVisit] =
      await Promise.all([
        this.prisma.rental.findFirst({
          where: { status: { not: 'PRESUPUESTO' } },
          orderBy: { eventDate: 'asc' },
          select: { eventDate: true },
        }),
        this.prisma.rental.findFirst({
          where: { status: { not: 'PRESUPUESTO' } },
          orderBy: { eventDate: 'desc' },
          select: { eventDate: true },
        }),
        this.prisma.siteVisit.findFirst({
          orderBy: { date: 'asc' },
          select: { date: true },
        }),
        this.prisma.siteVisit.findFirst({
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
      ]);

    // eventDate es una fecha de calendario pura (guardada como medianoche
    // UTC, ver nota en getDashboardData) — se lee con getters UTC, nunca
    // ajustada por huso horario. SiteVisit.date sí es un instante real, así
    // que se lee con el calendario de Paraguay (igual que en el resto del
    // servicio) para no correrse de año en las horas cercanas a la medianoche.
    const candidateYears = [
      currentYear,
      oldestRental?.eventDate.getUTCFullYear(),
      newestRental?.eventDate.getUTCFullYear(),
      oldestVisit ? utcToParaguayDate(oldestVisit.date).year : undefined,
      newestVisit ? utcToParaguayDate(newestVisit.date).year : undefined,
    ].filter((y): y is number => y !== undefined);

    const minYear = Math.min(...candidateYears);
    const maxYear = Math.max(...candidateYears);

    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y--) years.push(y);
    return years;
  }

  // 6. EL MOTOR DE ESTADÍSTICAS
  async getDashboardData(year: number, month?: number, day?: number) {
    // Un período inválido (mes 13, 31 de abril, año 0...) no debe convertirse
    // en fechas "desbordadas" que devuelvan datos de otro período sin avisar.
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Año inválido.');
    }
    if (
      month !== undefined &&
      (!Number.isInteger(month) || month < 1 || month > 12)
    ) {
      throw new BadRequestException(
        'Mes inválido: tiene que estar entre 1 y 12.',
      );
    }
    if (day !== undefined) {
      if (month === undefined)
        throw new BadRequestException(
          'Para consultar un día hay que indicar también el mes.',
        );
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
        throw new BadRequestException(
          `Día inválido: ese mes tiene ${daysInMonth} días.`,
        );
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

    // Período anterior (día anterior, mes anterior o año anterior): para
    // comparar las visitas en el gráfico y en los indicadores.
    let prevRealStart: Date | null = null;
    let prevRealEnd: Date | null = null;
    if (month && day) {
      const prev = new Date(Date.UTC(year, month - 1, day - 1));
      const [py, pm, pd] = [
        prev.getUTCFullYear(),
        prev.getUTCMonth() + 1,
        prev.getUTCDate(),
      ];
      prevRealStart = paraguayToUtc(py, pm, pd, 0, 0, 0);
      prevRealEnd = paraguayToUtc(py, pm, pd, 23, 59, 59, 999);
    } else {
      if (month) {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const lastDayPrev = new Date(
          Date.UTC(prevYear, prevMonth, 0),
        ).getUTCDate();
        prevRealStart = paraguayToUtc(prevYear, prevMonth, 1, 0, 0, 0);
        prevRealEnd = paraguayToUtc(
          prevYear,
          prevMonth,
          lastDayPrev,
          23,
          59,
          59,
          999,
        );
      } else {
        prevRealStart = paraguayToUtc(year - 1, 1, 1, 0, 0, 0);
        prevRealEnd = paraguayToUtc(year - 1, 12, 31, 23, 59, 59, 999);
      }
    }

    const [visitas, alquileres, checkoutIntents, visitasPrevias, metricas] =
      await Promise.all([
        this.prisma.siteVisit.findMany({
          where: { date: { gte: realStart, lte: realEnd } },
        }),
        this.prisma.rental.findMany({
          // Un alquiler anulado nunca se concretó, y un presupuesto todavía no:
          // ninguno suma ingresos, unidades ni conversión.
          where: {
            eventDate: { gte: calStart, lte: calEnd },
            status: { notIn: ['CANCELADO', 'PRESUPUESTO'] },
          },
          include: {
            items: { include: { product: { include: { category: true } } } },
            city: true,
          },
        }),
        // Los pedidos de WhatsApp no tienen "fecha de evento", solo el momento
        // en que el cliente los inició — se filtran por createdAt (real).
        this.prisma.checkoutIntent.findMany({
          where: { createdAt: { gte: realStart, lte: realEnd } },
          include: { items: true, rental: { select: { status: true } } },
        }),
        prevRealStart && prevRealEnd
          ? this.prisma.siteVisit.findMany({
              where: { date: { gte: prevRealStart, lte: prevRealEnd } },
            })
          : Promise.resolve<{ date: Date; count: number }[]>([]),
        // Contadores del sitio (páginas vistas, fichas, búsquedas, origen…).
        this.prisma.siteMetric.findMany({
          where: { date: { gte: realStart, lte: realEnd } },
          select: { date: true, type: true, key: true, count: true },
        }),
      ]);

    // --- TOP PRODUCTOS (por ingresos) ---
    const productStats: Record<
      number,
      { id: number; nombre: string; alquileres: number; ingresos: number }
    > = {};
    // --- INGRESOS POR CATEGORÍA ---
    const categoryStats: Record<
      string,
      { categoria: string; alquileres: number; ingresos: number }
    > = {};

    alquileres.forEach((rental) => {
      rental.items.forEach((item) => {
        if (!item.product) return; // Por si el producto fue borrado

        const precioUnitario = Number(
          item.unitPrice ?? item.product.pricePerDay,
        );
        const ingresoItem = item.quantity * precioUnitario;

        if (!productStats[item.productId]) {
          productStats[item.productId] = {
            id: item.productId,
            nombre: item.product.name,
            alquileres: 0,
            ingresos: 0,
          };
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

    const ingresosPorCategoria = Object.values(categoryStats).sort(
      (a, b) => b.ingresos - a.ingresos,
    );

    // --- DEMANDA POR CIUDAD ---
    const cityStats: Record<
      string,
      { ciudad: string; alquileres: number; ingresos: number }
    > = {};
    alquileres.forEach((rental) => {
      const ciudad = rental.city?.name ?? 'Sin especificar';
      if (!cityStats[ciudad])
        cityStats[ciudad] = { ciudad, alquileres: 0, ingresos: 0 };
      cityStats[ciudad].alquileres += 1;
      cityStats[ciudad].ingresos += Number(rental.totalPrice);
    });
    const demandaPorCiudad = Object.values(cityStats).sort(
      (a, b) => b.ingresos - a.ingresos,
    );

    // --- DATOS PARA LOS GRÁFICOS (buckets de tiempo) ---
    // Misma distinción que arriba: bucketOfCalendarDate lee eventDate con
    // getters UTC (fecha de calendario pura); bucketOfRealDate convierte el
    // instante real al calendario de Paraguay antes de ubicarlo en un bucket.
    type ChartPoint = {
      name: string;
      ingresos: number;
      pedidos: number;
      visitas: number;
      visitasAnterior: number;
      pedidosWhatsapp: number;
      paginasVistas: number;
    };
    const emptyPoint = (name: string): ChartPoint => ({
      name,
      ingresos: 0,
      pedidos: 0,
      visitas: 0,
      visitasAnterior: 0,
      pedidosWhatsapp: 0,
      paginasVistas: 0,
    });
    let chartData: ChartPoint[] = [];
    let bucketOfCalendarDate: (d: Date) => number;
    let bucketOfRealDate: (d: Date) => number;

    if (month && day) {
      // Un único bucket: el día completo (los gráficos de series no aportan
      // nada con un solo punto — el frontend muestra los KPIs en su lugar).
      chartData = [emptyPoint(`${day} ${MONTH_NAMES[month - 1]} ${year}`)];
      bucketOfCalendarDate = () => 0;
      bucketOfRealDate = () => 0;
    } else if (month) {
      // Día por día (antes eran 4 semanas: no se veía qué día hubo más visitas).
      const lastDay = calEnd.getUTCDate();
      const mName = MONTH_NAMES[month - 1];
      chartData = Array.from({ length: lastDay }, (_, i) =>
        emptyPoint(`${i + 1} ${mName}`),
      );
      bucketOfCalendarDate = (d) => d.getUTCDate() - 1;
      bucketOfRealDate = (d) => utcToParaguayDate(d).day - 1;
    } else {
      chartData = MONTH_NAMES.map((m) => emptyPoint(`${m} ${year}`));
      bucketOfCalendarDate = (d) => d.getUTCMonth();
      bucketOfRealDate = (d) => utcToParaguayDate(d).month - 1;
    }

    // El mes anterior puede tener más días que el actual (31 vs 30): esos
    // días de más no tienen dónde ir y se ignoran, en vez de romper.
    const at = (index: number) => chartData[index] as ChartPoint | undefined;

    visitas.forEach((v) => {
      const p = at(bucketOfRealDate(v.date));
      if (p) p.visitas += v.count;
    });
    visitasPrevias.forEach((v) => {
      const p = at(bucketOfRealDate(v.date));
      if (p) p.visitasAnterior += v.count;
    });
    alquileres.forEach((r) => {
      const p = at(bucketOfCalendarDate(r.eventDate));
      if (!p) return;
      p.pedidos += 1;
      p.ingresos += Number(r.totalPrice);
    });
    checkoutIntents.forEach((c) => {
      const p = at(bucketOfRealDate(c.createdAt));
      if (p) p.pedidosWhatsapp += 1;
    });
    metricas.forEach((m) => {
      if (m.type !== 'pageview') return;
      const p = at(bucketOfRealDate(m.date));
      if (p) p.paginasVistas += m.count;
    });

    // --- LO QUE MÁS QUIERE LA GENTE (sitio público) ---
    // Suma por clave de un tipo de contador en el período.
    const sumByKey = (type: string) => {
      const acc = new Map<string, number>();
      for (const m of metricas) {
        if (m.type === type) acc.set(m.key, (acc.get(m.key) ?? 0) + m.count);
      }
      return acc;
    };
    const total = (type: string) =>
      metricas.reduce((acc, m) => (m.type === type ? acc + m.count : acc), 0);
    const top = (
      map: Map<string, number>,
      limit: number,
      nameOf: (key: string) => string,
    ): Ranked[] =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([key, cantidad]) => ({ key, nombre: nameOf(key), cantidad }));

    const vistos = sumByKey('product_view');
    const agregados = sumByKey('add_to_cart');

    // Pedidos por WhatsApp por producto: en cuántos pedidos apareció y cuántas unidades.
    const pedidosPorProducto = new Map<
      number,
      { nombre: string; pedidos: number; unidades: number }
    >();
    for (const intent of checkoutIntents) {
      for (const item of intent.items) {
        const row = pedidosPorProducto.get(item.productId) ?? {
          nombre: item.productName,
          pedidos: 0,
          unidades: 0,
        };
        row.pedidos += 1;
        row.unidades += item.quantity;
        pedidosPorProducto.set(item.productId, row);
      }
    }

    // Nombres actuales de los productos que aparecen en los contadores (incluye dados de baja).
    const ids = [
      ...new Set([...vistos.keys(), ...agregados.keys()].map(Number)),
    ].filter(Number.isInteger);
    const productNames = new Map<number, string>(
      ids.length
        ? (
            await this.prisma.product.findMany({
              where: { id: { in: ids } },
              select: { id: true, name: true },
            })
          ).map((p) => [p.id, p.name])
        : [],
    );
    const productName = (key: string) =>
      productNames.get(Number(key)) ??
      pedidosPorProducto.get(Number(key))?.nombre ??
      `Producto #${key} (eliminado)`;

    const formatFecha = (key: string) => {
      const [y, m, d] = key.split('-').map(Number);
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    };

    // Fechas de evento que la gente consultó en el carrito y las que mandó en
    // pedidos: juntas muestran para cuándo hay demanda.
    const fechas = sumByKey('availability_check');
    for (const intent of checkoutIntents) {
      if (!intent.eventDate) continue;
      const key = intent.eventDate.toISOString().slice(0, 10);
      fechas.set(key, (fechas.get(key) ?? 0) + 1);
    }

    const interes = {
      masVistos: top(vistos, 10, productName),
      masAgregados: top(agregados, 10, productName),
      masPedidos: [...pedidosPorProducto.entries()]
        .sort(
          (a, b) =>
            b[1].unidades - a[1].unidades || b[1].pedidos - a[1].pedidos,
        )
        .slice(0, 10)
        .map(([id, row]) => ({
          key: String(id),
          nombre: productNames.get(id) ?? row.nombre,
          cantidad: row.unidades,
          pedidos: row.pedidos,
        })),
      fechasConsultadas: top(fechas, 10, formatFecha),
    };

    const busquedas = {
      total: total('search') + total('search_empty'),
      conResultados: top(sumByKey('search'), 15, (k) => k),
      sinResultados: top(sumByKey('search_empty'), 15, (k) => k),
    };

    const SOURCE_NAMES: Record<string, string> = {
      google: 'Google',
      otros_buscadores: 'Otros buscadores',
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
      tiktok: 'TikTok',
      youtube: 'YouTube',
      otros_sitios: 'Otros sitios web',
      directo: 'Directo (link guardado o escrito a mano)',
    };
    const DEVICE_NAMES: Record<string, string> = {
      celular: 'Celular',
      computadora: 'Computadora',
      tablet: 'Tablet',
    };
    const WHATSAPP_NAMES: Record<string, string> = {
      flotante: 'Botón verde flotante',
      contacto: 'Sección de contacto',
      rubro: 'Página de un rubro',
      producto: 'Ficha de producto',
      enlace: 'Otros enlaces',
    };
    const trafico = {
      fuentes: top(sumByKey('source'), 20, (k) => SOURCE_NAMES[k] ?? k),
      dispositivos: top(sumByKey('device'), 5, (k) => DEVICE_NAMES[k] ?? k),
      whatsapp: top(
        sumByKey('whatsapp_click'),
        10,
        (k) => WHATSAPP_NAMES[k] ?? k,
      ),
    };

    // --- KPIs ---
    const totalIngresos = alquileres.reduce(
      (acc, r) => acc + Number(r.totalPrice),
      0,
    );
    const totalAlquileres = alquileres.length;
    const totalVisitas = visitas.reduce((acc, v) => acc + v.count, 0);
    const totalVisitasAnterior = visitasPrevias.reduce(
      (acc, v) => acc + v.count,
      0,
    );
    const totalPedidosWhatsapp = checkoutIntents.length;
    const alquileresActivos = alquileres.filter(
      (r) => r.status === 'ACTIVO',
    ).length;
    const alquileresDevueltos = alquileres.filter(
      (r) => r.status === 'DEVUELTO',
    ).length;
    // De los alquileres de este período, cuántos todavía no llegaron a su
    // fecha de evento (fase derivada "ahora mismo", no guardada).
    const alquileresReservados = alquileres.filter(
      (r) => derivePhase(r).phase === 'RESERVADO',
    ).length;

    const duraciones = alquileres.map(
      (r) => (r.returnDate.getTime() - r.eventDate.getTime()) / MS_PER_DAY,
    );
    const anticipaciones = alquileres.map(
      (r) => (r.eventDate.getTime() - r.createdAt.getTime()) / MS_PER_DAY,
    );
    const promedio = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    let picoBucket: { name: string; ingresos: number } | null = null;
    for (const punto of chartData) {
      if (
        punto.ingresos > 0 &&
        (!picoBucket || punto.ingresos > picoBucket.ingresos)
      ) {
        picoBucket = { name: punto.name, ingresos: punto.ingresos };
      }
    }

    // Día (o mes, en la vista anual) con más visitantes del período.
    let picoVisitas: { name: string; visitas: number } | null = null;
    for (const punto of chartData) {
      if (
        punto.visitas > 0 &&
        (!picoVisitas || punto.visitas > picoVisitas.visitas)
      ) {
        picoVisitas = { name: punto.name, visitas: punto.visitas };
      }
    }

    // Día (o mes) con más alquileres cargados del período (para "Alquileres por Período").
    let picoAlquileres: { name: string; pedidos: number } | null = null;
    for (const punto of chartData) {
      if (
        punto.pedidos > 0 &&
        (!picoAlquileres || punto.pedidos > picoAlquileres.pedidos)
      ) {
        picoAlquileres = { name: punto.name, pedidos: punto.pedidos };
      }
    }

    // --- MANTELERÍA ---
    // Control de olvidos: cuántos alquileres del período llevaron algún mantel.
    // Se identifica el rubro por su nombre exacto ("Manteles") y se compara por
    // id. Si el rubro no existe, no hay cifra que mostrar (null), en vez de
    // marcar todos los alquileres como "sin manteles".
    const rubroManteles = await this.prisma.category.findUnique({
      where: { name: NOMBRE_RUBRO_MANTELES },
      select: { id: true },
    });
    const manteles = rubroManteles
      ? (() => {
          const conManteles = alquileres.filter((r) =>
            r.items.some((i) => i.product?.categoryId === rubroManteles.id),
          ).length;
          return { conManteles, sinManteles: totalAlquileres - conManteles };
        })()
      : null;

    const totalPaginasVistas = total('pageview');
    const kpis = {
      manteles,
      totalIngresos,
      ticketPromedio: totalAlquileres ? totalIngresos / totalAlquileres : 0,
      totalAlquileres,
      totalVisitas,
      totalVisitasAnterior,
      totalPaginasVistas,
      paginasPorVisita: totalVisitas ? totalPaginasVistas / totalVisitas : 0,
      totalPedidosWhatsapp,
      totalConsultasWhatsapp: total('whatsapp_click'),
      tasaVisitaPedido: totalVisitas
        ? (totalPedidosWhatsapp / totalVisitas) * 100
        : 0,
      tasaPedidoAlquiler: totalPedidosWhatsapp
        ? (totalAlquileres / totalPedidosWhatsapp) * 100
        : 0,
      duracionPromedioDias: promedio(duraciones),
      anticipacionPromedioDias: promedio(anticipaciones),
      alquileresActivos,
      alquileresDevueltos,
      alquileresReservados,
      picoBucket,
      picoVisitas,
      picoAlquileres,
    };

    const negocio = await this.businessInsights(
      { calStart, calEnd, year, month, day },
      alquileres,
      checkoutIntents,
      totalVisitasAnterior,
    );

    return {
      kpis,
      chartData,
      topProductos,
      ingresosPorCategoria,
      demandaPorCiudad,
      interes,
      busquedas,
      trafico,
      ...negocio,
    };
  }

  /**
   * Lo que agregó el rediseño de Estadísticas: comparación con el período
   * anterior, ingresos de los 12 meses contra el año pasado, rendimiento de
   * cada producto, qué día son los eventos, con cuánta anticipación reservan
   * y cuántos clientes repiten. Los cálculos viven en business-metrics.ts.
   */
  private async businessInsights(
    period: {
      calStart: Date;
      calEnd: Date;
      year: number;
      month?: number;
      day?: number;
    },
    alquileres: {
      eventDate: Date;
      createdAt: Date;
      totalPrice: number;
      items: {
        productId: number;
        quantity: number;
        unitPrice: Prisma.Decimal | null;
        product: { pricePerDay: Prisma.Decimal } | null;
      }[];
    }[],
    checkoutIntents: { status: string; rental: { status: string } | null }[],
    totalVisitasAnterior: number,
  ) {
    const { calStart, calEnd, year, month, day } = period;
    const from = toDayIndex(calStart);
    const to = toDayIndex(calEnd);
    const today = paraguayTodayIndex();

    // Período anterior del mismo tamaño en el calendario (día, mes o año).
    let prevFrom: number, prevTo: number;
    if (month && day) {
      prevFrom = from - 1;
      prevTo = from - 1;
    } else if (month) {
      prevFrom = toDayIndex(new Date(Date.UTC(year, month - 2, 1)));
      prevTo = from - 1;
    } else {
      prevFrom = toDayIndex(new Date(Date.UTC(year - 1, 0, 1)));
      prevTo = from - 1;
    }

    const [historial, ocupacion, productos] = await Promise.all([
      // Todo lo concretado (para "clientes que repiten" hace falta la historia
      // completa). Pocas columnas: alcanza para años de un negocio chico.
      this.prisma.rental.findMany({
        where: { status: { notIn: ['CANCELADO', 'PRESUPUESTO'] } },
        select: {
          clientName: true,
          clientPhone: true,
          eventDate: true,
          totalPrice: true,
        },
      }),
      // Lo que estuvo afuera en algún día del período (aunque el evento haya
      // empezado antes): es lo que cuenta para la ocupación.
      this.prisma.rental.findMany({
        where: {
          status: { in: ['ACTIVO', 'DEVUELTO'] },
          eventDate: { lte: calEnd },
          OR: [{ returnDate: { gte: calStart } }, { status: 'ACTIVO' }],
        },
        select: {
          status: true,
          eventDate: true,
          returnDate: true,
          items: { select: { productId: true, quantity: true } },
        },
      }),
      this.prisma.product.findMany({
        select: { id: true, name: true, totalStock: true, isArchived: true },
      }),
    ]);

    // --- Comparación con el período anterior ---
    const enRango = (d: Date, a: number, b: number) => {
      const i = toDayIndex(d);
      return i >= a && i <= b;
    };
    const anteriores = historial.filter((r) =>
      enRango(r.eventDate, prevFrom, prevTo),
    );
    const ingresosAnteriores = anteriores.reduce(
      (acc, r) => acc + Number(r.totalPrice),
      0,
    );
    const claves = historial.map((r) => ({
      key: clientKey(r.clientName, r.clientPhone),
      eventDay: toDayIndex(r.eventDate),
    }));
    const recurrentes = repeatClients(claves, from, to);
    const recurrentesAnteriores = repeatClients(claves, prevFrom, prevTo);

    const kpisAnteriores = {
      totalIngresos: ingresosAnteriores,
      totalAlquileres: anteriores.length,
      ticketPromedio: anteriores.length
        ? ingresosAnteriores / anteriores.length
        : 0,
      totalVisitas: totalVisitasAnterior,
      clientesRepitenPct: recurrentesAnteriores.clientes
        ? (recurrentesAnteriores.repiten / recurrentesAnteriores.clientes) * 100
        : 0,
    };
    const clientes = {
      total: recurrentes.clientes,
      repiten: recurrentes.repiten,
      pct: recurrentes.clientes
        ? (recurrentes.repiten / recurrentes.clientes) * 100
        : 0,
    };

    // --- Ingresos de los 12 meses del año elegido y del anterior ---
    const ingresosMensuales = {
      anio: year,
      actual: Array.from({ length: 12 }, () => 0),
      anterior: Array.from({ length: 12 }, () => 0),
    };
    for (const r of historial) {
      const y = r.eventDate.getUTCFullYear();
      const m = r.eventDate.getUTCMonth();
      if (y === year) ingresosMensuales.actual[m] += Number(r.totalPrice);
      else if (y === year - 1)
        ingresosMensuales.anterior[m] += Number(r.totalPrice);
    }

    // --- Rendimiento por producto ---
    const dias = to - from + 1;
    const uso = productOccupancy(
      ocupacion.map((r) => ({
        status: r.status,
        eventDay: toDayIndex(r.eventDate),
        returnDay: toDayIndex(r.returnDate),
        items: r.items,
      })),
      from,
      to,
      today,
    );
    // Ingresos y veces: con el mismo criterio que el resto de la pestaña
    // (alquileres cuyo EVENTO cae en el período).
    const ventas = new Map<
      number,
      { veces: number; unidades: number; ingresos: number }
    >();
    for (const r of alquileres) {
      const vistos = new Set<number>();
      for (const item of r.items) {
        const row = ventas.get(item.productId) ?? {
          veces: 0,
          unidades: 0,
          ingresos: 0,
        };
        if (!vistos.has(item.productId)) row.veces += 1;
        vistos.add(item.productId);
        row.unidades += item.quantity;
        row.ingresos +=
          item.quantity *
          Number(item.unitPrice ?? item.product?.pricePerDay ?? 0);
        ventas.set(item.productId, row);
      }
    }
    const rendimientoProductos = productos
      .filter((p) => !p.isArchived || ventas.has(p.id) || uso.has(p.id))
      .map((p) => {
        const u = uso.get(p.id);
        const v = ventas.get(p.id) ?? { veces: 0, unidades: 0, ingresos: 0 };
        const capacidad = p.totalStock * dias;
        const ocupacionPct =
          capacidad && u ? (u.unitDays / capacidad) * 100 : 0;
        const picoPct =
          p.totalStock && u ? (u.peakUnits / p.totalStock) * 100 : 0;
        return {
          id: p.id,
          nombre: p.name,
          stock: p.totalStock,
          archivado: p.isArchived,
          ocupacionPct,
          picoPct,
          picoFecha:
            u?.peakDay != null
              ? fromDayIndex(u.peakDay).toISOString().slice(0, 10)
              : null,
          veces: v.veces,
          unidades: v.unidades,
          ingresos: v.ingresos,
          ingresoPorUnidad: p.totalStock ? v.ingresos / p.totalStock : 0,
          sugerencia: p.isArchived
            ? null
            : suggestion(p.totalStock, ocupacionPct, picoPct, v.veces),
        };
      })
      .sort(
        (a, b) =>
          b.ocupacionPct - a.ocupacionPct ||
          b.ingresos - a.ingresos ||
          a.nombre.localeCompare(b.nombre),
      );

    // --- Cuándo son los eventos y con cuánta anticipación reservan ---
    const diasSemana = weekdayShare(
      alquileres.map((r) => toDayIndex(r.eventDate)),
    );
    const anticipacion = anticipationShare(
      alquileres.map((r) => {
        const c = utcToParaguayDate(r.createdAt);
        return {
          createdDay: toDayIndex(
            new Date(Date.UTC(c.year, c.month - 1, c.day)),
          ),
          eventDay: toDayIndex(r.eventDate),
        };
      }),
    );

    // Pedidos por WhatsApp del período que no terminaron en alquiler (los que
    // quedaron como presupuesto todavía no son una venta).
    const pedidosSinCerrar = checkoutIntents.filter(
      (c) => !isClosedSale(c),
    ).length;

    return {
      kpisAnteriores,
      clientes,
      ingresosMensuales,
      rendimientoProductos,
      diasSemana,
      anticipacion,
      pedidosSinCerrar,
    };
  }

  // 7. INICIO DEL PANEL: tasa de cierre de los últimos 30 días y meta del mes.
  async getHomeSummary() {
    const now = new Date();
    const desde = new Date(now.getTime() - 30 * MS_PER_DAY);
    const desdeAnterior = new Date(now.getTime() - 60 * MS_PER_DAY);
    const [pedidos, meta] = await Promise.all([
      this.prisma.checkoutIntent.findMany({
        where: { createdAt: { gte: desdeAnterior } },
        select: {
          createdAt: true,
          status: true,
          rental: { select: { status: true } },
        },
      }),
      this.prisma.appMeta.findUnique({ where: { key: MONTHLY_GOAL_KEY } }),
    ]);
    const resumen = (rows: typeof pedidos) => ({
      pedidos: rows.length,
      confirmados: rows.filter(isClosedSale).length,
    });
    const goal = meta ? Number(meta.value) : NaN;
    return {
      cierre: {
        dias: 30,
        ...resumen(pedidos.filter((p) => p.createdAt >= desde)),
        anterior: resumen(pedidos.filter((p) => p.createdAt < desde)),
      },
      metaMensual: Number.isFinite(goal) && goal > 0 ? goal : null,
    };
  }

  /** Meta de ingresos por mes (Gs.); null la borra. */
  async setMonthlyGoal(amount: number | null) {
    if (amount === null) {
      await this.prisma.appMeta.deleteMany({
        where: { key: MONTHLY_GOAL_KEY },
      });
      return { metaMensual: null };
    }
    const value = String(Math.round(amount));
    await this.prisma.appMeta.upsert({
      where: { key: MONTHLY_GOAL_KEY },
      update: { value },
      create: { key: MONTHLY_GOAL_KEY, value },
    });
    return { metaMensual: Number(value) };
  }
}
