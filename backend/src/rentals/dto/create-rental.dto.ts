import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// AAAA-MM-DD puro, opcionalmente con la medianoche UTC exacta que produce
// `new Date(...).toISOString()` (el panel siempre manda esa forma). Todo el
// cálculo de disponibilidad (ver common/timezone.ts) asume que estas fechas
// son medianoche UTC; @IsDateString() de class-validator aceptaba cualquier
// ISO 8601 válido, incluida una hora u offset distintos, que correrían el
// día calculado si algo aparte del panel llegara a mandar uno.
const FECHA_CALENDARIO = /^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/;

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

  @Matches(FECHA_CALENDARIO, {
    message: 'eventDate debe tener formato AAAA-MM-DD',
  })
  eventDate: string;

  @Matches(FECHA_CALENDARIO, {
    message: 'returnDate debe tener formato AAAA-MM-DD',
  })
  returnDate: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RentalItemDto)
  items: RentalItemDto[];
}
