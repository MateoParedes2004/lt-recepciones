import { quoteShipping, ShippingFormula } from './shipping-price';

const formula: ShippingFormula = {
  pricePerKm: 8000,
  freeUnderKm: 4,
  longDistanceFromKm: 25,
  longDistancePricePerKm: 6000,
  maxKm: 60,
  roundTo: 10000,
};

describe('quoteShipping', () => {
  it('reproduce los precios reales con los que se calibró la fórmula', () => {
    expect(quoteShipping(7.55, formula)).toEqual({
      kind: 'charged',
      price: 70000,
    }); // Sajonia
    expect(quoteShipping(11.8, formula)).toEqual({
      kind: 'charged',
      price: 100000,
    }); // San Lorenzo
    expect(quoteShipping(33.2, formula)).toEqual({
      kind: 'charged',
      price: 250000,
    }); // Villa Hayes
  });

  it('es gratis por debajo del mínimo y cobra todos los km desde ahí', () => {
    expect(quoteShipping(0, formula)).toEqual({ kind: 'free', price: 0 });
    expect(quoteShipping(3.9, formula)).toEqual({ kind: 'free', price: 0 });
    expect(quoteShipping(4, formula)).toEqual({
      kind: 'charged',
      price: 40000,
    });
  });

  it('pasa a "a coordinar" más allá del radio máximo, pero no justo en el límite', () => {
    expect(quoteShipping(60, formula).kind).toBe('charged');
    expect(quoteShipping(60.1, formula)).toEqual({
      kind: 'coordinate',
      price: 0,
    });
    expect(quoteShipping(500, { ...formula, maxKm: null }).kind).toBe(
      'charged',
    );
  });

  it('no sube un escalón por error de coma flotante en un monto exacto', () => {
    // 8.75 × 8000 = 70000 exacto; con floats puede dar 70000.00000000001.
    expect(quoteShipping(8.75, formula).price).toBe(70000);
  });

  it('sin redondeo devuelve el monto exacto en Gs.', () => {
    expect(quoteShipping(10.3, { ...formula, roundTo: 0 }).price).toBe(82400);
  });
});
