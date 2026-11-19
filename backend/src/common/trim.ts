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

/** Para @Transform: un texto vacío (o solo espacios) pasa a null. Sirve para campos opcionales que el panel manda como "" cuando se borran. */
export const emptyToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/**
 * Para @Transform de un texto corto de una sola línea y opcional (ej. el color
 * de un mantel): normaliza a NFC, junta los espacios y saltos de línea en un
 * solo espacio y lo recorta. Si queda vacío, pasa a null. Lo que no es texto
 * se deja como está para que la validación lo rechace.
 */
export const cleanLabel = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? emptyToNull({ value: value.normalize('NFC').replace(/\s+/g, ' ').trim() })
    : value;
