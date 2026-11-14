/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument --
   Prisma y el proveedor se simulan con jest.fn(): leer sus .mock.calls es justo lo que verifican estas pruebas. */
import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import type { InvoiceProvider } from './providers/invoice-provider';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import { parseCalendarDate } from './fiscal';

const HOUR = 60 * 60 * 1000;

const SETTINGS = {
  id: 1,
  businessName: 'X',
  tradeName: 'X',
  slogan: '',
  ruc: '5726203-9',
  activities: '',
  address: 'Calle',
  city: 'Asunción',
  phone: '',
  email: '',
  establishment: '001',
  expeditionPoint: '001',
  timbrado: '12345678',
  timbradoStart: null,
};

/** Una factura tal como la devuelve la base, con lo justo para estas pruebas. */
const invoice = (over: Record<string, unknown> = {}) => ({
  id: 7,
  environment: 'PRUEBA',
  timbrado: '12345678',
  establishment: '001',
  expeditionPoint: '001',
  number: 3,
  status: 'APROBADA',
  approvedAt: new Date(Date.now() - HOUR),
  issuer: { ruc: '5726203-9' },
  items: [],
  ...over,
});

const dto = (over: Partial<CreateInvoiceDto> = {}): CreateInvoiceDto => ({
  condition: 'CONTADO',
  customerType: 'SIN_NOMBRE',
  customerName: '',
  items: [{ description: 'Silla', quantity: 1, unitPrice: 1000, ivaRate: 10 }],
  ...over,
});

function setup(providerOver: Partial<InvoiceProvider> = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    invoiceSettings: { findUnique: jest.fn().mockResolvedValue(SETTINGS) },
    rental: { findUnique: jest.fn() },
    invoice: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(invoice({ status: 'PENDIENTE' })),
    },
  };
  const prisma = {
    ...tx,
    invoice: {
      ...tx.invoice,
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve(invoice({ status: 'PENDIENTE', ...data })),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    invoiceSettings: { ...tx.invoiceSettings, upsert: jest.fn() },
    $transaction: jest
      .fn()
      .mockImplementation((cb: (t: typeof tx) => unknown) => cb(tx)),
  };
  const provider: jest.Mocked<InvoiceProvider> = {
    isTest: true,
    label: 'test',
    emit: jest.fn().mockResolvedValue({
      status: 'APROBADA',
      cdc: '1'.repeat(44),
      qrUrl: 'qr',
    }),
    cancel: jest.fn().mockResolvedValue(undefined),
    ...providerOver,
  } as jest.Mocked<InvoiceProvider>;
  const service = new InvoicesService(prisma as any, provider);
  return { service, prisma, tx, provider };
}

describe('InvoicesService.create', () => {
  beforeEach(() =>
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it('rechaza un total mayor al tope SIN tocar la base (error de ceros de más)', async () => {
    const { service, prisma } = setup();
    await expect(
      service.create(
        dto({
          items: [
            {
              description: 'x',
              quantity: 10,
              unitPrice: 1_000_000_000,
              ivaRate: 10,
            },
          ],
        }),
        1,
      ),
    ).rejects.toThrow(/supera Gs\. 2\.000\.000\.000/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza texto que el PDF no puede imprimir (emojis, japonés) SIN tocar la base', async () => {
    const { service, prisma } = setup();
    await expect(
      service.create(
        dto({
          customerType: 'RUC',
          customerDocument: '80038950-6',
          customerName: 'Boda 💍',
        }),
        1,
      ),
    ).rejects.toThrow(/nombre del cliente.*💍/);
    await expect(
      service.create(dto({ customerAddress: 'Calle 日本' }), 1),
    ).rejects.toThrow(/dirección del cliente/);
    await expect(
      service.create(
        dto({
          items: [
            {
              description: 'Mantel 🎉',
              quantity: 1,
              unitPrice: 1000,
              ivaRate: 10,
            },
          ],
        }),
        1,
      ),
    ).rejects.toThrow(/renglón 1.*🎉/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('acepta justo el tope', async () => {
    const { service } = setup();
    await expect(
      service.create(
        dto({
          items: [
            {
              description: 'x',
              quantity: 2,
              unitPrice: 1_000_000_000,
              ivaRate: 10,
            },
          ],
        }),
        1,
      ),
    ).resolves.toBeDefined();
  });

  it('rechaza total 0, RUC con dígito verificador malo y cédula con letras', async () => {
    const { service } = setup();
    await expect(
      service.create(
        dto({
          items: [{ description: 'x', quantity: 1, unitPrice: 0, ivaRate: 10 }],
        }),
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        dto({
          customerType: 'RUC',
          customerDocument: '80038950-5',
          customerName: 'A',
        }),
        1,
      ),
    ).rejects.toThrow(/RUC del cliente/);
    await expect(
      service.create(
        dto({
          customerType: 'CI',
          customerDocument: '45A67',
          customerName: 'A',
        }),
        1,
      ),
    ).rejects.toThrow(/cédula/);
  });

  it('un alquiler que no existe → 404; presupuesto o anulado → 409; ya facturado → 409', async () => {
    const { service, tx } = setup();
    tx.rental.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.create(dto({ rentalId: 9 }), 1),
    ).rejects.toBeInstanceOf(NotFoundException);
    tx.rental.findUnique.mockResolvedValueOnce({ status: 'PRESUPUESTO' });
    await expect(service.create(dto({ rentalId: 9 }), 1)).rejects.toThrow(
      /presupuesto/,
    );
    tx.rental.findUnique.mockResolvedValueOnce({ status: 'CANCELADO' });
    await expect(service.create(dto({ rentalId: 9 }), 1)).rejects.toThrow(
      /anulado/,
    );
    tx.rental.findUnique.mockResolvedValueOnce({ status: 'ACTIVO' });
    tx.invoice.findFirst.mockResolvedValueOnce(invoice({ number: 12 }));
    await expect(service.create(dto({ rentalId: 9 }), 1)).rejects.toThrow(
      /0000012/,
    );
  });

  it('numera la siguiente a la última de la misma serie', async () => {
    const { service, tx } = setup();
    tx.invoice.findFirst.mockResolvedValueOnce({ number: 41 });
    await service.create(dto(), 1);
    expect(tx.invoice.create.mock.calls[0][0].data.number).toBe(42);
  });

  it('con el proveedor de producción exige el timbrado electrónico', async () => {
    const { service, tx } = setup({ isTest: false });
    tx.invoiceSettings.findUnique.mockResolvedValue({
      ...SETTINGS,
      timbrado: '',
    });
    await expect(service.create(dto(), 1)).rejects.toThrow(/timbrado/);
  });

  it('si la DNIT no responde: queda PENDIENTE, con aviso y el motivo real en el log', async () => {
    const { service, prisma } = setup({
      emit: jest.fn().mockRejectedValue(new Error('ECONNRESET')),
    });
    const result = await service.create(dto(), 1);
    expect(result.status).toBe('PENDIENTE');
    expect(prisma.invoice.update.mock.calls[0][0].data.statusMessage).toMatch(
      /No se pudo comunicar/,
    );
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  it('si la DNIT rechaza: queda RECHAZADA con su motivo', async () => {
    const { service, prisma } = setup({
      emit: jest
        .fn()
        .mockResolvedValue({ status: 'RECHAZADA', message: 'RUC inexistente' }),
    });
    await service.create(dto(), 1);
    expect(prisma.invoice.update.mock.calls[0][0].data).toEqual({
      status: 'RECHAZADA',
      statusMessage: 'RUC inexistente',
    });
  });

  it('si la DNIT aprueba: guarda CDC, QR y fecha de aprobación', async () => {
    const { service, prisma } = setup();
    await service.create(dto(), 1);
    const data = prisma.invoice.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: 'APROBADA',
      cdc: '1'.repeat(44),
      qrUrl: 'qr',
      statusMessage: null,
    });
    expect(data.approvedAt).toBeInstanceOf(Date);
  });
});

describe('InvoicesService.retry', () => {
  it('solo reintenta las PENDIENTE', async () => {
    const { service, prisma } = setup();
    for (const status of ['APROBADA', 'RECHAZADA', 'ANULADA']) {
      prisma.invoice.findUnique.mockResolvedValueOnce(invoice({ status }));
      await expect(service.retry(7)).rejects.toBeInstanceOf(ConflictException);
    }
    prisma.invoice.findUnique.mockResolvedValueOnce(null);
    await expect(service.retry(7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('una PENDIENTE se vuelve a enviar y puede quedar aprobada', async () => {
    const { service, prisma, provider } = setup();
    prisma.invoice.findUnique.mockResolvedValueOnce(
      invoice({ status: 'PENDIENTE' }),
    );
    await service.retry(7);
    expect(provider.emit).toHaveBeenCalledTimes(1);
    expect(prisma.invoice.update.mock.calls[0][0].data.status).toBe('APROBADA');
  });
});

describe('InvoicesService.cancel', () => {
  beforeEach(() =>
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it('no anula una factura pendiente, ni una ya anulada (no responde éxito en silencio)', async () => {
    const { service, prisma, provider } = setup();
    prisma.invoice.findUnique.mockResolvedValueOnce(
      invoice({ status: 'PENDIENTE' }),
    );
    await expect(service.cancel(7, 'motivo válido')).rejects.toThrow(
      /reintentala/,
    );
    prisma.invoice.findUnique.mockResolvedValueOnce(
      invoice({ status: 'ANULADA' }),
    );
    await expect(service.cancel(7, 'motivo válido')).rejects.toThrow(
      /ya está anulada/,
    );
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });

  it('pasadas las 48 h no se puede anular (corresponde nota de crédito) y no se avisa a la DNIT', async () => {
    const { service, prisma, provider } = setup();
    prisma.invoice.findUnique.mockResolvedValueOnce(
      invoice({ approvedAt: new Date(Date.now() - 49 * HOUR) }),
    );
    await expect(service.cancel(7, 'motivo válido')).rejects.toThrow(
      /48 horas/,
    );
    expect(provider.cancel).not.toHaveBeenCalled();
  });

  it('justo dentro de las 48 h sí se anula, avisando al proveedor', async () => {
    const { service, prisma, provider } = setup();
    prisma.invoice.findUnique.mockResolvedValueOnce(
      invoice({ approvedAt: new Date(Date.now() - 47 * HOUR) }),
    );
    prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(
      invoice({ status: 'ANULADA' }),
    );
    await service.cancel(7, 'Error en la cantidad');
    expect(provider.cancel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      'Error en la cantidad',
    );
    expect(prisma.invoice.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'ANULADA',
      cancelReason: 'Error en la cantidad',
    });
  });

  it('si la DNIT no responde al anular: 503, NO queda anulada en la base y se registra el error', async () => {
    const { service, prisma } = setup({
      cancel: jest.fn().mockRejectedValue(new Error('timeout')),
    });
    prisma.invoice.findUnique.mockResolvedValueOnce(invoice());
    await expect(service.cancel(7, 'motivo válido')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
    expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
  });

  it('una RECHAZADA nunca tuvo validez: se anula sin avisar a la DNIT', async () => {
    const { service, prisma, provider } = setup();
    prisma.invoice.findUnique.mockResolvedValueOnce(
      invoice({ status: 'RECHAZADA', approvedAt: null }),
    );
    prisma.invoice.findUniqueOrThrow.mockResolvedValueOnce(
      invoice({ status: 'ANULADA' }),
    );
    await service.cancel(7, 'motivo válido');
    expect(provider.cancel).not.toHaveBeenCalled();
    expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(1);
  });

  it('si otra persona la anuló en el mismo instante → 409', async () => {
    const { service, prisma } = setup();
    prisma.invoice.findUnique.mockResolvedValueOnce(invoice());
    prisma.invoice.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.cancel(7, 'motivo válido')).rejects.toThrow(
      /ya está anulada/,
    );
  });
});

describe('InvoicesService.updateSettings', () => {
  const base = { ...SETTINGS, activities: 'a' };
  it('rechaza un RUC inválido y una fecha que no existe en el calendario', async () => {
    const { service, prisma } = setup();
    await expect(
      service.updateSettings({ ...base, ruc: '5726203-1' }),
    ).rejects.toThrow(/RUC del emisor/);
    await expect(
      service.updateSettings({ ...base, timbradoStart: '2026-02-31' }),
    ).rejects.toThrow(/no existe en el calendario/);
    await expect(
      service.updateSettings({ ...base, timbradoStart: '2026-13-45' }),
    ).rejects.toThrow(/no existe en el calendario/);
    expect(prisma.invoiceSettings.upsert).not.toHaveBeenCalled();
  });

  it('rechaza emojis y caracteres que el PDF no imprime en los datos del encabezado', async () => {
    const { service, prisma } = setup();
    await expect(
      service.updateSettings({ ...base, businessName: 'LT 🎉' }),
    ).rejects.toThrow(/razón social/);
    await expect(
      service.updateSettings({ ...base, activities: 'Bebidas\nAlquiler 日本' }),
    ).rejects.toThrow(/actividades/);
    expect(prisma.invoiceSettings.upsert).not.toHaveBeenCalled();
  });
});

describe('parseCalendarDate', () => {
  it('solo acepta días que existen', () => {
    expect(parseCalendarDate('2026-11-01')?.toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
    expect(parseCalendarDate('2028-02-29')).not.toBeNull(); // bisiesto
    expect(parseCalendarDate('2027-02-29')).toBeNull();
    expect(parseCalendarDate('2026-02-31')).toBeNull();
    expect(parseCalendarDate('2026-00-10')).toBeNull();
    expect(parseCalendarDate('2026-4-5')).toBeNull();
    expect(parseCalendarDate('01/11/2026')).toBeNull();
  });
});
