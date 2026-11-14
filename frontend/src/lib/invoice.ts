// Utilidades de facturación que usa el panel (formulario, lista y PDF). Las
// reglas fiscales "de verdad" las aplica el backend (backend/src/invoices/fiscal.ts);
// acá se repiten solo para mostrar la vista previa y avisar errores antes de enviar.
import type { IvaRate, Rental } from "../types";

/** 1705000 → "1.705.000" */
export const formatThousands = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** "001-001-0000120" */
export const formatInvoiceNumber = (inv: { establishment: string; expeditionPoint: string; number: number }) =>
  `${inv.establishment}-${inv.expeditionPoint}-${String(inv.number).padStart(7, "0")}`;

/** Dígito verificador módulo 11 de la DNIT (RUC y CDC). */
function mod11CheckDigit(digits: string): number {
  let factor = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * factor;
    factor = factor === 11 ? 2 : factor + 1;
  }
  const remainder = sum % 11;
  return remainder > 1 ? 11 - remainder : 0;
}

/** "80038950-6" → true si el dígito verificador corresponde (atrapa casi todos los errores de tipeo). */
export function isValidRuc(raw: string): boolean {
  const match = raw.replace(/[.\s]/g, "").match(/^(\d{1,8})-(\d)$/);
  return !!match && mod11CheckDigit(match[1]) === Number(match[2]);
}

// Caracteres extra que la fuente del PDF (Helvetica, Windows-1252) sabe dibujar.
const WIN_ANSI_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);
const isPrintableChar = (ch: string) => {
  const code = ch.codePointAt(0) ?? 0;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch);
};

/**
 * Deja un texto con solo lo que el PDF puede dibujar (igual que `findUnprintable` del
 * backend, que es quien lo exige). Una letra con tilde rara se reemplaza por su base
 * ("ĩ" → "i"); emojis, japonés, etc. se quitan. `changed` dice qué se tocó, para avisar.
 * Sin esto la fuente del PDF imprime basura ("Mantel 🎉" salía como "Mantel <‰").
 */
export function toPrintable(text: string): { text: string; changed: string[] } {
  const changed = new Set<string>();
  let out = "";
  for (const ch of text.normalize("NFC")) {
    if (isPrintableChar(ch)) { out += ch; continue; }
    changed.add(ch);
    const base = ch.normalize("NFD")[0];
    if (base && base !== ch && isPrintableChar(base)) out += base;
  }
  return { text: out.replace(/\s+/g, " ").trim(), changed: [...changed] };
}

/** Tope del total de una factura (igual que el backend: los montos son enteros de 32 bits). */
export const MAX_INVOICE_TOTAL = 2_000_000_000;

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  ivaRate: IvaRate;
  productId?: number | null;
}

/** Totales con precios IVA INCLUIDO, igual que el backend: IVA 10 % = total/11, 5 % = total/21. */
export function computeTotals(lines: Pick<InvoiceLine, "quantity" | "unitPrice" | "ivaRate">[]) {
  const sumAt = (rate: IvaRate) => lines.filter((l) => l.ivaRate === rate).reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const taxed10 = sumAt(10);
  const taxed5 = sumAt(5);
  const exempt = sumAt(0);
  return { total: taxed10 + taxed5 + exempt, taxed10, taxed5, exempt, iva10: Math.round(taxed10 / 11), iva5: Math.round(taxed5 / 21) };
}

/**
 * Las líneas de un alquiler tal como van en la factura o el presupuesto: un
 * renglón por producto con su precio del alquiler, y el envío como
 * "Transporte" (igual que en el talonario).
 */
export function linesFromRental(rental: Rental): InvoiceLine[] {
  const lines: InvoiceLine[] = rental.items.map((item) => ({
    description: item.product?.name ?? "Producto",
    quantity: item.quantity,
    unitPrice: Math.round(Number(item.unitPrice ?? item.product?.pricePerDay ?? 0)),
    ivaRate: 10,
    productId: item.productId,
  }));
  const shipping = Math.round(Number(rental.shippingPrice ?? 0));
  if (shipping > 0) lines.push({ description: "Transporte", quantity: 1, unitPrice: shipping, ivaRate: 10, productId: null });
  return lines;
}

// ------------------------------------------------------- monto en letras

const UNITS = [
  "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez",
  "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte",
  "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const TENS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function below1000(n: number): string {
  if (n === 100) return "cien";
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (rest > 0 && rest < 30) parts.push(UNITS[rest]);
  else if (rest >= 30) parts.push(rest % 10 ? `${TENS[Math.floor(rest / 10)]} y ${UNITS[rest % 10]}` : TENS[Math.floor(rest / 10)]);
  return parts.join(" ");
}

// "uno" pierde la "o" delante de "mil"/"millones": veintiún mil, treinta y un millones.
const apocope = (words: string) => words.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un");

/**
 * 1705000 → "un millón setecientos cinco mil" (como se escribe en "Total a pagar").
 * Devuelve "" para lo que no es un monto razonable (NaN, infinito, más de un billón):
 * sin esa guarda, un precio tipeado como 1e999 hacía recursión infinita y rompía la pantalla.
 */
export function numberToSpanishWords(n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) >= 1e12) return "";
  n = Math.floor(Math.abs(n));
  if (n === 0) return "cero";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "un millón" : `${apocope(numberToSpanishWords(millions))} millones`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${apocope(below1000(thousands))} mil`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

// ------------------------------------------------------------- fechas

/** Instante real (ej. emisión) → "5 de noviembre de 2026", en hora de Paraguay. */
export const formatLongDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "long", year: "numeric" });

/** Fecha de calendario pura (medianoche UTC, ej. evento o inicio del timbrado) → "05/11/2026". */
export const formatCalendarDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PY", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

// --------------------------------------------------- entregar el PDF

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * En el celular abre el menú de "Compartir" del sistema con el PDF adjunto
 * (WhatsApp, correo, Drive, imprimir…). En la computadora, o donde el
 * navegador no puede compartir archivos, lo descarga.
 * Devuelve "shared" | "downloaded" | "cancelled".
 */
export async function sharePdf(blob: Blob, fileName: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], fileName, { type: "application/pdf" });
  // Solo en pantallas táctiles (celular/tablet): en la computadora el menú de
  // compartir del sistema es incómodo y lo práctico es tener el archivo descargado.
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
  if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName, text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // NotAllowedError u otro: se cae a la descarga.
    }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}
