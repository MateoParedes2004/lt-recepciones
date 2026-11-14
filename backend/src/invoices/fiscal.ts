// Reglas fiscales puras de Paraguay (sin base de datos ni red), para poder
// probarlas por separado. Las usa el servicio de facturas y el proveedor de prueba.

/**
 * Dígito verificador "módulo 11" que usa la DNIT, tanto para el RUC como para
 * el CDC de los documentos electrónicos: se recorren los dígitos de derecha a
 * izquierda multiplicándolos por 2, 3, … 11 (y se vuelve a 2), y el dígito es
 * 11 − (suma mod 11), o 0 si el resto es 0 o 1.
 */
export function mod11CheckDigit(digits: string): number {
  let factor = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * factor;
    factor = factor === 11 ? 2 : factor + 1;
  }
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : 0;
}

/**
 * Valida un RUC escrito como "80038950-6" (con o sin puntos) y lo devuelve
 * normalizado, o null si el formato o el dígito verificador no cierran. El
 * dígito verificador atrapa casi todos los errores de tipeo.
 */
export function normalizeRuc(raw: string): string | null {
  const match = raw.replace(/[.\s]/g, '').match(/^(\d{1,8})-(\d)$/);
  if (!match) return null;
  const [, base, dv] = match;
  return mod11CheckDigit(base) === Number(dv) ? `${base}-${dv}` : null;
}

/**
 * Tope del total de una factura: las columnas de montos son enteros de 32 bits
 * (máx. 2.147.483.647). Poner el límite en Gs. 2.000 millones convierte un
 * error de tipeo (ceros de más) en un aviso claro en vez de un error de la base.
 */
export const MAX_INVOICE_TOTAL = 2_000_000_000;

/**
 * "2026-11-01" → Date a medianoche UTC, o null si no es un día que exista
 * ("2026-02-31" o "2026-13-45" no valen). `new Date()` los "corrige" en silencio.
 */
export function parseCalendarDate(raw: string): Date | null {
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  return isReal ? date : null;
}

// Caracteres extra que la fuente del PDF (Helvetica, codificación Windows-1252) sabe dibujar.
const WIN_ANSI_EXTRA = new Set([...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ']);

/** ¿La fuente del PDF puede dibujar este carácter? (ASCII, Latin-1 y los símbolos de Windows-1252) */
export function isPrintableChar(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_EXTRA.has(ch)
  );
}

/**
 * Los caracteres de un texto que NO se pueden imprimir en el PDF (emojis,
 * japonés, "Ł", flechas…). La fuente no los omite: los reemplaza por basura
 * ("Mantel 🎉" salía como "Mantel <‰"), y una factura no puede imprimir algo
 * distinto de lo que guardó. Por eso se rechazan en vez de guardarlos.
 */
export function findUnprintable(text: string): string[] {
  return [
    ...new Set([...text.normalize('NFC')].filter((c) => !isPrintableChar(c))),
  ];
}

export type IvaRate = 0 | 5 | 10;

export interface InvoiceLineInput {
  quantity: number;
  unitPrice: number;
  ivaRate: IvaRate;
}

export interface InvoiceTotals {
  total: number;
  taxed10: number;
  taxed5: number;
  exempt: number;
  iva10: number;
  iva5: number;
}

/**
 * Totales de una factura con precios IVA INCLUIDO (como el talonario): el IVA
 * se "liquida" desde adentro del precio, 10 % → total/11 y 5 % → total/21.
 * Ej.: Gs. 1.705.000 al 10 % → IVA Gs. 155.000.
 */
export function computeTotals(lines: InvoiceLineInput[]): InvoiceTotals {
  const sumAt = (rate: IvaRate) =>
    lines
      .filter((l) => l.ivaRate === rate)
      .reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const taxed10 = sumAt(10);
  const taxed5 = sumAt(5);
  const exempt = sumAt(0);
  return {
    total: taxed10 + taxed5 + exempt,
    taxed10,
    taxed5,
    exempt,
    iva10: Math.round(taxed10 / 11),
    iva5: Math.round(taxed5 / 21),
  };
}

/** "001-001-0000120": así se imprime el número de una factura. */
export function formatInvoiceNumber(inv: {
  establishment: string;
  expeditionPoint: string;
  number: number;
}): string {
  return `${inv.establishment}-${inv.expeditionPoint}-${String(inv.number).padStart(7, '0')}`;
}
