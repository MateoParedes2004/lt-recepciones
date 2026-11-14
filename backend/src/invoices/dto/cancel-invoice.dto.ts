import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/trim';

export class CancelInvoiceDto {
  // La DNIT exige un motivo de entre 5 y 500 caracteres para cancelar.
  @Transform(trimString)
  @IsString()
  @MinLength(5, { message: 'Escribí un motivo de al menos 5 caracteres.' })
  @MaxLength(500)
  reason: string;
}
