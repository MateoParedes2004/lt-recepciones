import { Transform, Type } from 'class-transformer';
import { trimString } from '../../common/trim';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
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
}
