import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// Topes reales de la base: pricePerDay es Decimal(10,2) (hasta 99.999.999,99)
// y totalStock es un Int de Postgres (hasta 2.147.483.647). Sin este @Max, un
// valor que los supera no lo rechaza este DTO sino Postgres, con un error que
// el filtro de excepciones no reconoce y cae a un 500 genérico: el admin ve
// "error inesperado" sin ninguna pista de que el número que tipeó es el problema.
export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
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
