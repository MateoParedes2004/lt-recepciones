import {
  computeTotals,
  findUnprintable,
  formatInvoiceNumber,
  mod11CheckDigit,
  normalizeRuc,
} from './fiscal';
import { cleanText } from '../common/trim';

describe('normalizeRuc', () => {
  it('acepta RUC reales con su dígito verificador', () => {
    expect(normalizeRuc('5726203-9')).toBe('5726203-9');
    expect(normalizeRuc('80038950-6')).toBe('80038950-6');
    expect(normalizeRuc(' 80.038.950-6 ')).toBe('80038950-6');
  });

  it('rechaza un dígito verificador equivocado o un formato inválido', () => {
    expect(normalizeRuc('80038950-5')).toBeNull();
    expect(normalizeRuc('80038950')).toBeNull();
    expect(normalizeRuc('ABC-1')).toBeNull();
    expect(normalizeRuc('123456789-0')).toBeNull();
  });
});

describe('mod11CheckDigit', () => {
  it('da 0 cuando el resto es 0 o 1', () => {
    // 11 → 1·2 + 1·3 = 5 → 11 − 5 = 6; "0" → resto 0 → 0
    expect(mod11CheckDigit('11')).toBe(6);
    expect(mod11CheckDigit('0')).toBe(0);
  });
});

describe('computeTotals', () => {
  it('liquida el IVA incluido como en el talonario (1.705.000 → 155.000)', () => {
    const totals = computeTotals([
      { quantity: 1, unitPrice: 1_625_000, ivaRate: 10 },
      { quantity: 1, unitPrice: 80_000, ivaRate: 10 },
    ]);
    expect(totals).toEqual({
      total: 1_705_000,
      taxed10: 1_705_000,
      taxed5: 0,
      exempt: 0,
      iva10: 155_000,
      iva5: 0,
    });
  });

  it('separa las tasas del 10 %, 5 % y exentas', () => {
    const totals = computeTotals([
      { quantity: 2, unitPrice: 11_000, ivaRate: 10 },
      { quantity: 1, unitPrice: 21_000, ivaRate: 5 },
      { quantity: 3, unitPrice: 1_000, ivaRate: 0 },
    ]);
    expect(totals).toEqual({
      total: 46_000,
      taxed10: 22_000,
      taxed5: 21_000,
      exempt: 3_000,
      iva10: 2_000,
      iva5: 1_000,
    });
  });
});

describe('formatInvoiceNumber', () => {
  it('rellena el número a 7 dígitos', () => {
    expect(
      formatInvoiceNumber({
        establishment: '001',
        expeditionPoint: '001',
        number: 120,
      }),
    ).toBe('001-001-0000120');
  });
});

describe('findUnprintable', () => {
  it('acepta el español, las comillas tipográficas y los símbolos de Windows-1252', () => {
    expect(
      findUnprintable('Ñandú Ç Ü ñ — “comillas” ‘x’ €5 ™ … ½ ° º'),
    ).toEqual([]);
    expect(
      findUnprintable('Cnel. Gaudioso Núñez Nº 961 (Barrio Mburicao)'),
    ).toEqual([]);
  });

  it('señala emojis, japonés y letras que la fuente del PDF no dibuja', () => {
    expect(findUnprintable('Mantel 🎉')).toEqual(['🎉']);
    expect(findUnprintable('日本語 Łódź → ✓')).toEqual([
      '日',
      '本',
      '語',
      'Ł',
      'ź',
      '→',
      '✓',
    ]);
    expect(findUnprintable('ĩ ũ ỹ')).toEqual(['ĩ', 'ũ', 'ỹ']);
  });

  it('cuenta como no imprimibles los saltos de línea, tabulaciones y caracteres de control', () => {
    expect(findUnprintable('a\nb')).toEqual(['\n']);
    expect(findUnprintable('a\tb\u0000')).toEqual(['\t', '\u0000']);
  });

  it('una "ñ" escrita como n + tilde suelta se normaliza y es válida', () => {
    expect(findUnprintable('n\u0303')).toEqual([]);
    expect(cleanText({ value: '  Ña' + 'n\u0303' + '  ' })).toBe('Ñañ');
    expect(cleanText({ value: 42 })).toBe(42);
  });
});
