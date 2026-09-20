import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional } from 'class-validator';

export class RentalAvailabilityQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  // Al editar un alquiler, el propio alquiler no debe contar como ocupación.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  excludeRentalId?: number;
}
