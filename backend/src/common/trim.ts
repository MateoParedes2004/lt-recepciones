/** Para @Transform de class-transformer: saca espacios del principio y del final de un texto. */
export const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
