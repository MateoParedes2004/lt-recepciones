import { Transform, Type } from 'class-transformer';
import { trimString } from '../../common/trim';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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

  // Posición en el catálogo (menor número primero). Si no se manda, el backend
  // lo pone al final. Es un entero: el panel manda undefined si se deja vacío,
  // nunca "" (Number("") daría 0 y reordenaría el rubro sin querer).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  sortOrder?: number;
}
