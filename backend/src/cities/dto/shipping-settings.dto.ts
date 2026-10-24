import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ShippingSettingsDto {
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  pricePerKm: number;

  @IsNumber()
  @Min(0)
  @Max(1000)
  freeUnderKm: number;

  @IsNumber()
  @Min(0)
  @Max(5000)
  longDistanceFromKm: number;

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  longDistancePricePerKm: number;

  // null = sin límite (todas las distancias con precio automático).
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  maxKm: number | null;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  roundTo: number;
}
