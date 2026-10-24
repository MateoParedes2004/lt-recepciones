import { Transform, Type } from 'class-transformer';
import { trimString } from '../../common/trim';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCityDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  // Km por ruta desde el local; null para borrarlos.
  @IsNumber()
  @Min(0)
  @Max(5000)
  @IsOptional()
  distanceKm?: number | null;

  // true: el precio lo calcula la fórmula de envío (ver CitiesService).
  @IsBoolean()
  @IsOptional()
  priceFromFormula?: boolean;
}
