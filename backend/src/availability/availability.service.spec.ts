import { AvailabilityService, peakUsage } from './availability.service';
import { derivePhase } from '../rentals/rentals.service';
import {
  formatDayIndex,
  fromDayIndex,
  paraguayTodayIndex,
  toDayIndex,
} from '../common/timezone';

// Día 100 = un día cualquiera; los alquileres se expresan en días consecutivos.
const iv = (start: number, end: number, quantity: number) => ({
  start,
  end,
  quantity,
});

describe('peakUsage (máximo de unidades ocupadas a la vez)', () => {
  it('sin alquileres no ocupa nada', () => {
    expect(peakUsage([], 100, 110)).toEqual({ peak: 0, day: null });
  });

  it('dos alquileres que NO coinciden en ningún día usan el mayor, no la suma', () => {
    // 6 sillas del 100 al 102 y otras 6 del 103 al 105: nunca hay más de 6 afuera.
    expect(peakUsage([iv(100, 102, 6), iv(103, 105, 6)], 100, 110).peak).toBe(
      6,
    );
  });

  it('dos alquileres que se solapan un solo día suman ese día', () => {
    const r = peakUsage([iv(100, 102, 6), iv(102, 104, 3)], 100, 110);
    expect(r.peak).toBe(9);
    expect(r.day).toBe(102);
  });

  it('los extremos son inclusivos: devolver el día X ocupa el día X', () => {
    // A termina el 102 y B empieza el 102: chocan.
    expect(peakUsage([iv(100, 102, 4), iv(102, 103, 4)], 100, 103).peak).toBe(
      8,
    );
    // B empieza el 103: ya no chocan.
    expect(peakUsage([iv(100, 102, 4), iv(103, 104, 4)], 100, 104).peak).toBe(
      4,
    );
  });

  it('solo cuenta lo que cae dentro del rango consultado', () => {
    // Un alquiler enorme pero fuera del rango no molesta.
    expect(peakUsage([iv(100, 105, 50)], 106, 110).peak).toBe(0);
    // Uno que apenas roza el primer día del rango sí cuenta.
    expect(peakUsage([iv(95, 100, 5)], 100, 110).peak).toBe(5);
  });

  it('un alquiler de un solo día (inicio = fin) ocupa ese día', () => {
    expect(peakUsage([iv(100, 100, 7)], 100, 100).peak).toBe(7);
  });

  it('varios alquileres escalonados: el pico está donde más se acumulan', () => {
    // 100-101: 2 | 101-103: 2+3 | 102-104: 2+3+4 (pico 9 el día 102) | 105: 4
    const r = peakUsage(
      [iv(100, 102, 2), iv(101, 103, 3), iv(102, 105, 4)],
      100,
      110,
    );
    expect(r.peak).toBe(9);
    expect(r.day).toBe(102);
  });

  it('el mismo producto en dos alquileres idénticos suma', () => {
    expect(peakUsage([iv(100, 101, 3), iv(100, 101, 3)], 100, 101).peak).toBe(
      6,
    );
  });
});

describe('derivePhase (etapa de un alquiler según sus fechas)', () => {
  const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const hoy = toDayIndex(at('2026-10-10'));
  const rental = (status: string, event: string, ret: string) => ({
    status,
    eventDate: at(event),
    returnDate: at(ret),
  });

  it('todavía no llegó el evento -> RESERVADO', () => {
    expect(
      derivePhase(rental('ACTIVO', '2026-10-15', '2026-10-16'), hoy),
    ).toEqual({ phase: 'RESERVADO', daysOverdue: 0 });
  });

  it('el día del evento -> EN_USO', () => {
    expect(
      derivePhase(rental('ACTIVO', '2026-10-10', '2026-10-12'), hoy).phase,
    ).toBe('EN_USO');
  });

  it('el día de la devolución sigue EN_USO (todavía no venció)', () => {
    expect(
      derivePhase(rental('ACTIVO', '2026-10-08', '2026-10-10'), hoy).phase,
    ).toBe('EN_USO');
  });

  it('pasó la devolución y sigue ACTIVO -> ATRASADO con los días de atraso', () => {
    expect(
      derivePhase(rental('ACTIVO', '2026-10-05', '2026-10-07'), hoy),
    ).toEqual({ phase: 'ATRASADO', daysOverdue: 3 });
  });

  it('devuelto y anulado nunca están atrasados aunque las fechas ya pasaron', () => {
    expect(
      derivePhase(rental('DEVUELTO', '2026-10-01', '2026-10-02'), hoy),
    ).toEqual({ phase: 'DEVUELTO', daysOverdue: 0 });
    expect(
      derivePhase(rental('CANCELADO', '2026-10-01', '2026-10-02'), hoy),
    ).toEqual({ phase: 'CANCELADO', daysOverdue: 0 });
  });
});

describe('formatDayIndex', () => {
  it('formatea dd/mm/aaaa', () => {
    expect(
      formatDayIndex(toDayIndex(new Date('2026-03-07T00:00:00.000Z'))),
    ).toBe('07/03/2026');
  });
});

describe('withAvailability — lowStock (alerta de stock bajo)', () => {
  const today = paraguayTodayIndex();
  // Un alquiler ACTIVO que ocupa `quantity` unidades de `productId` desde
  // `startOffset` días desde hoy hasta `endOffset` días desde hoy.
  const activeRentalItem = (
    productId: number,
    quantity: number,
    startOffset: number,
    endOffset: number,
  ) => ({
    productId,
    quantity,
    rental: {
      eventDate: fromDayIndex(today + startOffset),
      returnDate: fromDayIndex(today + endOffset),
    },
  });

  function serviceWithRentalItems(rows: ReturnType<typeof activeRentalItem>[]) {
    const prisma = {
      rentalItem: { findMany: jest.fn().mockResolvedValue(rows) },
    };
    return new AvailabilityService(prisma as any);
  }

  it('sin ningún alquiler futuro, nunca es stock bajo (aunque el producto tenga pocas unidades)', async () => {
    const service = serviceWithRentalItems([]);
    const [result] = await service.withAvailability([
      { id: 1, name: 'Mesa Chica', totalStock: 2 },
    ]);
    expect(result.lowStock).toBe(false);
  });

  it('demanda que deja casi todo ocupado en las próximas semanas -> stock bajo', async () => {
    // Producto con 10 unidades; un alquiler de 9 dentro del horizonte de 60 días: quedan 1 libre.
    const service = serviceWithRentalItems([activeRentalItem(1, 9, 10, 15)]);
    const [result] = await service.withAvailability([
      { id: 1, name: 'Silla Tiffany', totalStock: 10 },
    ]);
    expect(result.lowStock).toBe(true);
  });

  it('demanda liviana dentro del horizonte -> NO es stock bajo', async () => {
    // Mismo producto de 10, pero solo se comprometen 2 (quedan 8 libres: muy por encima del umbral del 20%).
    const service = serviceWithRentalItems([activeRentalItem(1, 2, 10, 15)]);
    const [result] = await service.withAvailability([
      { id: 1, name: 'Silla Tiffany', totalStock: 10 },
    ]);
    expect(result.lowStock).toBe(false);
  });

  it('demanda fuera del horizonte de 60 días no cuenta para la alerta', async () => {
    // Un alquiler que ocupa casi todo, pero recién dentro de 90 días: fuera del horizonte que se mira.
    const service = serviceWithRentalItems([activeRentalItem(1, 9, 90, 95)]);
    const [result] = await service.withAvailability([
      { id: 1, name: 'Silla Tiffany', totalStock: 10 },
    ]);
    expect(result.lowStock).toBe(false);
  });

  it('el umbral tiene un piso de 1 unidad para productos con pocas unidades en total', async () => {
    // Producto con 2 unidades en total; se reserva 1 (queda 1 libre): max(1, ceil(2*0.2)) = 1 -> alerta.
    const service = serviceWithRentalItems([activeRentalItem(1, 1, 10, 15)]);
    const [result] = await service.withAvailability([
      { id: 1, name: 'Carpa Grande', totalStock: 2 },
    ]);
    expect(result.lowStock).toBe(true);
  });
});
