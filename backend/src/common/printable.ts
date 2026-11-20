/**
 * Qué caracteres puede dibujar la fuente de los PDF (presupuestos y facturas).
 * Lo comparten las facturas y el color de los manteles y servilletas de un alquiler: ambos
 * se imprimen y no pueden salir como basura. (El frontend tiene su copia en
 * frontend/src/lib/invoice.ts › toPrintable, que además limpia el texto.)
 */

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
