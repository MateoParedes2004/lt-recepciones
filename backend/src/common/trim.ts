/** Para @Transform de class-transformer: saca espacios del principio y del final de un texto. */
export const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Como `trimString`, y además normaliza a NFC: una "ñ" pegada como "n" + tilde
 * suelta pasa a ser la letra "ñ" de verdad. Para textos que se imprimen en
 * documentos fiscales.
 */
export const cleanText = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.normalize('NFC').trim() : value;
