import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Invoice, InvoiceItem, InvoiceSettings, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeTotals,
  formatInvoiceNumber,
  findUnprintable,
  MAX_INVOICE_TOTAL,
  normalizeRuc,
  parseCalendarDate,
} from './fiscal';
import { ISSUER_DEFAULTS } from './issuer-defaults';
import {
  EmitResult,
  INVOICE_PROVIDER,
  type InvoiceProvider,
} from './providers/invoice-provider';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceSettingsDto } from './dto/invoice-settings.dto';

type Tx = Prisma.TransactionClient;

const INVOICE_INCLUDE = {
  items: { orderBy: { id: 'asc' } },
  createdBy: { select: { name: true } },
} satisfies Prisma.InvoiceInclude;

// La DNIT permite cancelar una factura electrónica aprobada dentro de las 48
// horas; pasado ese plazo, el error se corrige con una nota de crédito.
const CANCEL_WINDOW_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(INVOICE_PROVIDER) private provider: InvoiceProvider,
  ) {}

  // ------------------------------------------------------------ emisor

  /** La fila única de datos del emisor; la primera vez se crea con los del talonario. */
  async getSettings(tx: Tx = this.prisma): Promise<InvoiceSettings> {
    const existing = await tx.invoiceSettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return tx.invoiceSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...ISSUER_DEFAULTS },
      update: {},
    });
  }

  async getSettingsView() {
    return {
      settings: await this.getSettings(),
      provider: { isTest: this.provider.isTest, label: this.provider.label },
    };
  }

  /**
   * Rechaza texto con caracteres que el PDF no puede dibujar (emojis, japonés,
   * "Ł"…): saldrían como basura en una factura. Ver `findUnprintable`.
   */
  private assertPrintable(label: string, text: string | undefined) {
    const bad = findUnprintable(text ?? '');
    if (bad.length > 0)
      throw new BadRequestException(
        `${label} tiene caracteres que no se pueden imprimir en la factura: ${bad.join(' ')}. Quitalos o reemplazalos por letras comunes.`,
      );
  }

  async updateSettings(dto: InvoiceSettingsDto) {
    for (const [label, text] of [
      ['La razón social', dto.businessName],
      ['El nombre de fantasía', dto.tradeName],
      ['La frase del encabezado', dto.slogan],
      ['La dirección', dto.address],
      ['La ciudad', dto.city],
      ['Las actividades', dto.activities.split('\n').join(' ')],
    ] as const)
      this.assertPrintable(label, text);
    const ruc = normalizeRuc(dto.ruc);
    if (!ruc)
      throw new BadRequestException(
        'El RUC del emisor no es válido: revisá el número y el dígito verificador.',
      );
    let timbradoStart: Date | null = null;
    if (dto.timbradoStart) {
      timbradoStart = parseCalendarDate(dto.timbradoStart);
      if (!timbradoStart)
        throw new BadRequestException(
          'La fecha de inicio del timbrado no existe en el calendario.',
        );
    }
    const data = {
      ...dto,
      ruc,
      activities: dto.activities
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join('\n'),
      timbradoStart,
    };
    await this.prisma.invoiceSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    return this.getSettingsView();
  }

  // ----------------------------------------------------------- facturas

  findAll() {
    return this.prisma.invoice.findMany({
      include: INVOICE_INCLUDE,
      orderBy: { id: 'desc' },
    });
  }

  /** Valida y normaliza los datos del cliente según cómo se identifica. */
  private resolveCustomer(dto: CreateInvoiceDto) {
    const name = dto.customerName.trim();
    switch (dto.customerType) {
      case 'RUC': {
        const ruc = normalizeRuc(dto.customerDocument ?? '');
        if (!ruc)
          throw new BadRequestException(
            'El RUC del cliente no es válido: revisá el número y el dígito verificador (ej. 80038950-6).',
          );
        if (!name)
          throw new BadRequestException(
            'Falta el nombre o la razón social del cliente.',
          );
        return { customerDocument: ruc, customerName: name };
      }
      case 'CI': {
        const ci = (dto.customerDocument ?? '').replace(/[.\s]/g, '');
        if (!/^\d{4,10}$/.test(ci))
          throw new BadRequestException(
            'El número de cédula no es válido (solo números, ej. 4567890).',
          );
        if (!name)
          throw new BadRequestException('Falta el nombre del cliente.');
        return { customerDocument: ci, customerName: name };
      }
      default:
        // Consumidor final sin identificar: así lo nombra el SIFEN.
        return { customerDocument: null, customerName: 'Sin Nombre' };
    }
  }

  async create(dto: CreateInvoiceDto, userId: number) {
    this.assertPrintable('El nombre del cliente', dto.customerName);
    this.assertPrintable('La dirección del cliente', dto.customerAddress);
    dto.items.forEach((l, i) =>
      this.assertPrintable(
        `La descripción del renglón ${i + 1}`,
        l.description,
      ),
    );
    const customer = this.resolveCustomer(dto);
    const totals = computeTotals(dto.items);
    if (totals.total <= 0)
      throw new BadRequestException(
        'El total de la factura tiene que ser mayor a Gs. 0.',
      );
    if (totals.total > MAX_INVOICE_TOTAL)
      throw new BadRequestException(
        'El total de la factura supera Gs. 2.000.000.000: revisá las cantidades y los precios (¿ceros de más?).',
      );
    const environment = this.provider.isTest ? 'PRUEBA' : 'PRODUCCION';

    const invoice = await this.prisma.$transaction(
      async (tx) => {
        const settings = await this.getSettings(tx);
        // Bloquea la fila del emisor: dos facturas emitidas al mismo tiempo
        // esperan una a la otra, así nunca reciben el mismo número ni se
        // factura dos veces el mismo alquiler.
        await tx.$queryRaw`SELECT "id" FROM "InvoiceSettings" WHERE "id" = 1 FOR UPDATE`;

        if (!this.provider.isTest && !settings.timbrado) {
          throw new BadRequestException(
            'Falta cargar el timbrado electrónico en "Datos del emisor".',
          );
        }

        if (dto.rentalId !== undefined) {
          const rental = await tx.rental.findUnique({
            where: { id: dto.rentalId },
            select: { status: true },
          });
          if (!rental)
            throw new NotFoundException(
              `El alquiler con ID ${dto.rentalId} no existe.`,
            );
          if (rental.status === 'PRESUPUESTO')
            throw new ConflictException(
              'Es un presupuesto: confirmalo antes de facturarlo.',
            );
          if (rental.status === 'CANCELADO')
            throw new ConflictException(
              'El alquiler está anulado: no se puede facturar.',
            );
          const existing = await tx.invoice.findFirst({
            where: {
              rentalId: dto.rentalId,
              status: { in: ['APROBADA', 'PENDIENTE'] },
            },
          });
          if (existing)
            throw new ConflictException(
              `Este alquiler ya tiene la factura ${formatInvoiceNumber(existing)}.`,
            );
        }

        const series = {
          environment,
          timbrado: settings.timbrado,
          establishment: settings.establishment,
          expeditionPoint: settings.expeditionPoint,
        };
        const last = await tx.invoice.findFirst({
          where: series,
          orderBy: { number: 'desc' },
          select: { number: true },
        });

        return tx.invoice.create({
          data: {
            ...series,
            number: (last?.number ?? 0) + 1,
            condition: dto.condition,
            customerType: dto.customerType,
            ...customer,
            customerAddress: dto.customerAddress || null,
            customerEmail: dto.customerEmail || null,
            customerPhone: dto.customerPhone || null,
            ...totals,
            issuer: {
              businessName: settings.businessName,
              tradeName: settings.tradeName,
              slogan: settings.slogan,
              ruc: settings.ruc,
              activities: settings.activities,
              address: settings.address,
              city: settings.city,
              phone: settings.phone,
              email: settings.email,
              timbradoStart: settings.timbradoStart?.toISOString() ?? null,
            },
            rentalId: dto.rentalId ?? null,
            createdById: userId,
            items: {
              create: dto.items.map((l) => ({
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                ivaRate: l.ivaRate,
                total: l.quantity * l.unitPrice,
                productId: l.productId ?? null,
              })),
            },
          },
          include: { items: true },
        });
      },
      { timeout: 15000 },
    );

    return this.send(invoice);
  }

  /**
   * Manda la factura al proveedor y guarda la respuesta. Si no hubo
   * comunicación, la factura queda PENDIENTE (con su número ya reservado)
   * para reintentarla: nunca se pierde ni se duplica.
   */
  private async send(invoice: Invoice & { items: InvoiceItem[] }) {
    let result: EmitResult;
    try {
      result = await this.provider.emit(invoice);
    } catch (err) {
      // Queda PENDIENTE para reintentar, pero el motivo real se registra: sin
      // esto una caída del proveedor sería invisible en los logs del servidor.
      this.logger.error(
        `No se pudo enviar la factura ${formatInvoiceNumber(invoice)} (id ${invoice.id}) al proveedor`,
        err instanceof Error ? err.stack : String(err),
      );
      return this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          statusMessage:
            'No se pudo comunicar con la DNIT. Probá "Reintentar" en unos minutos.',
        },
        include: INVOICE_INCLUDE,
      });
    }
    const data: Prisma.InvoiceUpdateInput =
      result.status === 'APROBADA'
        ? {
            status: 'APROBADA',
            cdc: result.cdc,
            qrUrl: result.qrUrl,
            approvedAt: new Date(),
            statusMessage: null,
          }
        : { status: 'RECHAZADA', statusMessage: result.message };
    return this.prisma.invoice.update({
      where: { id: invoice.id },
      data,
      include: INVOICE_INCLUDE,
    });
  }

  private async findOneOrFail(id: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!invoice)
      throw new NotFoundException(`La factura con ID ${id} no existe.`);
    return invoice;
  }

  async retry(id: number) {
    const invoice = await this.findOneOrFail(id);
    if (invoice.status !== 'PENDIENTE')
      throw new ConflictException(
        'Solo se reintenta una factura que quedó pendiente.',
      );
    return this.send(invoice);
  }

  async cancel(id: number, reason: string) {
    const invoice = await this.findOneOrFail(id);
    if (invoice.status === 'PENDIENTE') {
      throw new ConflictException(
        'La factura todavía no tiene respuesta de la DNIT: reintentala primero.',
      );
    }
    if (invoice.status === 'ANULADA') {
      throw new ConflictException('Esta factura ya está anulada.');
    }
    if (invoice.status === 'APROBADA') {
      if (
        !invoice.approvedAt ||
        Date.now() - invoice.approvedAt.getTime() > CANCEL_WINDOW_MS
      ) {
        throw new ConflictException(
          'Pasaron más de 48 horas desde que se aprobó: ya no se puede anular. Para corregirla corresponde una nota de crédito.',
        );
      }
      try {
        await this.provider.cancel(invoice, reason);
      } catch (err) {
        this.logger.error(
          `No se pudo anular la factura ${formatInvoiceNumber(invoice)} (id ${invoice.id}) ante el proveedor`,
          err instanceof Error ? err.stack : String(err),
        );
        throw new ServiceUnavailableException(
          'No se pudo comunicar con la DNIT para anular la factura. Probá de nuevo en unos minutos.',
        );
      }
    }
    // Una RECHAZADA nunca tuvo validez: se marca anulada sin avisar a nadie,
    // solo para que el alquiler se pueda volver a facturar.
    const result = await this.prisma.invoice.updateMany({
      where: { id, status: { in: ['APROBADA', 'RECHAZADA'] } },
      data: {
        status: 'ANULADA',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
    // Si 0 filas cambiaron, otra persona la anuló en el mismo instante.
    if (result.count === 0)
      throw new ConflictException('Esta factura ya está anulada.');
    return this.prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: INVOICE_INCLUDE,
    });
  }
}
