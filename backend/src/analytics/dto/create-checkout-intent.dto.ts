import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CheckoutIntentItemDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity: number;
}

export class CreateCheckoutIntentDto {
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  totalAmount: number;

  @IsInt()
  @Min(1)
  @Max(100_000)
  itemCount: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cityName?: string;

  // Id de la ciudad elegida (si todavía existe al momento del pedido), para
  // poder precargarla exacta al confirmar el alquiler sin adivinar por nombre.
  @IsOptional()
  @IsInt()
  @Min(1)
  cityId?: number;

  // Qué productos llevaba el pedido (opcional: versiones viejas del sitio no lo mandan).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CheckoutIntentItemDto)
  items?: CheckoutIntentItemDto[];

  // Fechas elegidas en el carrito (AAAA-MM-DD), si las cargó.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'eventDate debe tener formato AAAA-MM-DD',
  })
  eventDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'returnDate debe tener formato AAAA-MM-DD',
  })
  returnDate?: string;
}
