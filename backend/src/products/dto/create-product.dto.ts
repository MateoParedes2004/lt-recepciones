import { Transform, Type } from 'class-transformer';
import { trimString } from '../../common/trim';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

// Topes reales de la base: pricePerDay es Decimal(10,2) (hasta 99.999.999,99)
// y totalStock es un Int de Postgres (hasta 2.147.483.647). Sin este @Max, un
// valor que los supera no lo rechaza este DTO sino Postgres, con un error que
// el filtro de excepciones no reconoce y cae a un 500 genérico: el admin ve
// "error inesperado" sin ninguna pista de que el número que tipeó es el problema.
export class CreateProductDto {
  // Sin espacios sueltos al principio/fin ("   " ya no pasa como nombre) y con
  // tope: el nombre termina en el título de Google y en la dirección de la ficha.
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  pricePerDay: number;

  @Type(() => Number)
  @IsInt()
  categoryId: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  @IsOptional()
  totalStock?: number;
}
