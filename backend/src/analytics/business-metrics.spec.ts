import { toDayIndex } from '../common/timezone';
import {
  anticipationShare,
  clientKey,
  productOccupancy,
  repeatClients,
  suggestion,
  weekdayShare,
} from './business-metrics';

const D = (iso: string) => toDayIndex(new Date(`${iso}T00:00:00Z`));

describe('productOccupancy', () => {
  const from = D('2026-11-01');
  const to = D('2026-11-30');
  const today = D('2026-11-15');
  const rental = (
    status: string,
    ev: string,
    ret: string,
    items: [number, number][],
  ) => ({
    status,
    eventDay: D(ev),
    returnDay: D(ret),
    items: items.map(([productId, quantity]) => ({ productId, quantity })),
  });

  it('cuenta días del evento a la devolución, ambos inclusive', () => {
    const r = productOccupancy(
      [rental('DEVUELTO', '2026-11-05', '2026-11-07', [[1, 10]])],
      from,
      to,
      today,
    );
    expect(r.get(1)).toEqual({
      unitDays: 30,
      peakUnits: 10,
      peakDay: D('2026-11-05'),
    });
  });

  it('suma alquileres que se pisan y encuentra el pico', () => {
    const r = productOccupancy(
      [
        rental('ACTIVO', '2026-11-20', '2026-11-21', [[1, 10]]),
        rental('ACTIVO', '2026-11-21', '2026-11-22', [
          [1, 5],
          [2, 3],
        ]),
      ],
      from,
      to,
      today,
    );
    expect(r.get(1)).toEqual({
      unitDays: 30,
      peakUnits: 15,
      peakDay: D('2026-11-21'),
    });
    expect(r.get(2)?.unitDays).toBe(6);
  });

  it('recorta lo que cae fuera del período', () => {
    const r = productOccupancy(
      [rental('DEVUELTO', '2026-10-30', '2026-11-02', [[1, 4]])],
      from,
      to,
      today,
    );
    expect(r.get(1)?.unitDays).toBe(8); // 1 y 2 de noviembre
  });

  it('un ACTIVO atrasado sigue ocupando hasta hoy', () => {
    const r = productOccupancy(
      [rental('ACTIVO', '2026-11-10', '2026-11-12', [[1, 2]])],
      from,
      to,
      today,
    );
    expect(r.get(1)?.unitDays).toBe(12); // del 10 al 15
  });

  it('presupuestos y anulados no ocupan', () => {
    const r = productOccupancy(
      [
        rental('PRESUPUESTO', '2026-11-10', '2026-11-12', [[1, 2]]),
        rental('CANCELADO', '2026-11-10', '2026-11-12', [[1, 2]]),
      ],
      from,
      to,
      today,
    );
    expect(r.size).toBe(0);
  });

  it('coincide con un conteo día por día (fuerza bruta)', () => {
    const rentals = [
      rental('ACTIVO', '2026-10-25', '2026-11-03', [[1, 7]]),
      rental('DEVUELTO', '2026-11-03', '2026-11-03', [[1, 2]]),
      rental('ACTIVO', '2026-11-28', '2026-12-04', [[1, 9]]),
      rental('ACTIVO', '2026-11-08', '2026-11-09', [[1, 1]]),
    ];
    let unitDays = 0;
    let peak = 0;
    for (let d = from; d <= to; d++) {
      let n = 0;
      for (const r of rentals) {
        const end =
          r.status === 'ACTIVO' ? Math.max(r.returnDay, today) : r.returnDay;
        if (d >= r.eventDay && d <= end) n += r.items[0].quantity;
      }
      unitDays += n;
      peak = Math.max(peak, n);
    }
    const got = productOccupancy(rentals, from, to, today).get(1);
    expect(got?.unitDays).toBe(unitDays);
    expect(got?.peakUnits).toBe(peak);
  });

  it('período vacío o invertido: sin datos', () => {
    expect(productOccupancy([], to, from, today).size).toBe(0);
  });
});

describe('weekdayShare', () => {
  it('ordena de lunes a domingo', () => {
    // 16/11/2026 es lunes; 21 sábado; 22 domingo.
    const share = weekdayShare([
      D('2026-11-16'),
      D('2026-11-21'),
      D('2026-11-21'),
      D('2026-11-22'),
    ]);
    expect(share).toEqual([25, 0, 0, 0, 0, 50, 25]);
  });
  it('sin eventos: todo en cero', () => {
    expect(weekdayShare([])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('anticipationShare', () => {
  it('agrupa por días entre la carga y el evento', () => {
    const ev = D('2026-12-31');
    const res = anticipationShare([
      { createdDay: ev - 3, eventDay: ev },
      { createdDay: ev - 6, eventDay: ev },
      { createdDay: ev - 7, eventDay: ev },
      { createdDay: ev - 30, eventDay: ev },
      { createdDay: ev - 45, eventDay: ev },
      { createdDay: ev - 90, eventDay: ev },
      { createdDay: ev + 2, eventDay: ev }, // carga retroactiva
      { createdDay: ev - 14, eventDay: ev },
    ]);
    expect(res.map((b) => b.count)).toEqual([3, 2, 1, 1, 1]);
    expect(res.reduce((a, b) => a + b.pct, 0)).toBeCloseTo(100);
  });
});

describe('clientKey', () => {
  it('mismo teléfono escrito distinto = mismo cliente', () => {
    expect(clientKey('Ana', '0981 123 456')).toBe(
      clientKey('Ana María', '+595 981123456'),
    );
  });
  it('sin teléfono usa el nombre sin tildes ni mayúsculas', () => {
    expect(clientKey('  José  Pérez ', null)).toBe(clientKey('jose perez', ''));
  });
  it('sin datos: null', () => {
    expect(clientKey('', '12')).toBeNull();
  });
});

describe('repeatClients', () => {
  const nov1 = D('2026-11-01');
  const nov30 = D('2026-11-30');
  it('cuenta a quien ya tuvo un evento antes del período', () => {
    const res = repeatClients(
      [
        { key: 'a', eventDay: D('2026-05-01') },
        { key: 'a', eventDay: D('2026-11-10') },
        { key: 'b', eventDay: D('2026-11-12') },
        { key: 'b', eventDay: D('2026-11-20') }, // dos en el mismo período: no repite "de antes"
        { key: 'c', eventDay: D('2026-12-05') }, // fuera del período
        { key: null, eventDay: D('2026-11-02') },
      ],
      nov1,
      nov30,
    );
    expect(res).toEqual({ clientes: 2, repiten: 1 });
  });
});

describe('suggestion', () => {
  it('reglas', () => {
    expect(suggestion(100, 40, 95, 3)).toBe('comprar_mas');
    expect(suggestion(100, 0, 0, 0)).toBe('sin_movimiento');
    expect(suggestion(100, 2, 10, 1)).toBe('sobra_stock');
    // Ocupación promedio baja pero un día salió el 40 %: no sobra.
    expect(suggestion(100, 2, 40, 1)).toBeNull();
    expect(suggestion(100, 40, 60, 5)).toBeNull();
    expect(suggestion(0, 0, 0, 0)).toBeNull();
  });
});
