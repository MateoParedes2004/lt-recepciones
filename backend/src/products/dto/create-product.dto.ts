import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

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
  pricePerDay: number;

  @Type(() => Number)
  @IsInt()
  categoryId: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  totalStock?: number;
}
