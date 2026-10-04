import { Transform } from 'class-transformer';
import { trimString } from '../../common/trim';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCategoryDto {
  // El nombre arma la dirección de la página del rubro (/catalogos/sillas).
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  // El formulario manda "" cuando se deja vacío: lo guardamos como null.
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
