import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutIntentDto } from './dto/create-checkout-intent.dto';
import { PublicEventType } from './dto/track-event.dto';
import {
  paraguayToUtc,
  paraguayTodayUtc,
  utcToParaguayDate,
} from '../common/timezone';
import { deviceFromUserAgent, isBotUserAgent } from '../common/user-agent';

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

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

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

    let eventDate: Date | undefined;
    if (dto.eventDate) {
      const [y, m, d] = dto.eventDate.split('-').map(Number);
      const parsed = new Date(Date.UTC(y, m - 1, d));
      if (
        parsed.getUTCFullYear() === y &&
        parsed.getUTCMonth() === m - 1 &&
        parsed.getUTCDate() === d
      ) {
        eventDate = parsed;
      }
    }

    const intent = await this.prisma.checkoutIntent.create({
      data: {
        totalAmount: dto.totalAmount,
        itemCount: dto.itemCount,
        cityName: dto.cityName,
        eventDate,
        items: {
          create: products.map((p) => ({
            productId: p.id,
            productName: p.name,
            quantity: requested.get(p.id) ?? 1,
          })),
        },
      },
      select: { id: true },
    });
    return { success: true, intent };
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
          orderBy: { eventDate: 'asc' },
          select: { eventDate: true },
        }),
        this.prisma.rental.findFirst({
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

    // Período anterior (mes anterior si se mira un mes, año anterior si se mira
    // un año): solo se usa para comparar visitas en el gráfico. Con un solo día
    // no hay gráfico de series, así que no se consulta.
    let prevRealStart: Date | null = null;
    let prevRealEnd: Date | null = null;
    if (!day) {
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
          // Un alquiler anulado nunca se concretó: no suma ingresos, unidades ni conversión.
          where: {
            eventDate: { gte: calStart, lte: calEnd },
            status: { not: 'CANCELADO' },
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
          include: { items: true },
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

    const totalPaginasVistas = total('pageview');
    const kpis = {
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
      picoBucket,
      picoVisitas,
    };

    return {
      kpis,
      chartData,
      topProductos,
      ingresosPorCategoria,
      demandaPorCiudad,
      interes,
      busquedas,
      trafico,
    };
  }
}
