import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RentalItemDto {
  @IsInt()
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateRentalDto {
  @IsString()
  @MinLength(1)
  clientName: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  // null = "sin especificar" (al editar, permite quitar la ciudad).
  @IsOptional()
  @IsInt()
  cityId?: number | null;

  @IsDateString()
  eventDate: string;

  @IsDateString()
  returnDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RentalItemDto)
  items: RentalItemDto[];
}
