import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { cleanText, trimString } from '../../common/trim';

export class InvoiceSettingsDto {
  @Transform(cleanText)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  businessName: string;

  @Transform(cleanText)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tradeName: string;

  @Transform(cleanText)
  @IsString()
  @MaxLength(150)
  slogan: string;

  // El dígito verificador lo controla el servicio.
  @Transform(trimString)
  @IsString()
  @MaxLength(12)
  ruc: string;

  @IsString()
  @MaxLength(1000)
  activities: string;

  @Transform(cleanText)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address: string;

  @Transform(cleanText)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city: string;

  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  phone: string;

  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  email: string;

  @Matches(/^\d{3}$/, {
    message: 'El establecimiento son 3 dígitos (ej. 001).',
  })
  establishment: string;

  @Matches(/^\d{3}$/, {
    message: 'El punto de expedición son 3 dígitos (ej. 001).',
  })
  expeditionPoint: string;

  @Matches(/^(\d{8})?$/, {
    message: 'El timbrado son 8 dígitos (o vacío si todavía no lo tenés).',
  })
  timbrado: string;

  // AAAA-MM-DD o null.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de inicio del timbrado debe tener formato AAAA-MM-DD.',
  })
  timbradoStart?: string | null;
}
