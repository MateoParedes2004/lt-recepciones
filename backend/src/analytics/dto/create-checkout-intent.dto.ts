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

  // Qué productos llevaba el pedido (opcional: versiones viejas del sitio no lo mandan).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CheckoutIntentItemDto)
  items?: CheckoutIntentItemDto[];

  // Fecha del evento elegida en el carrito (AAAA-MM-DD), si la cargó.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'eventDate debe tener formato AAAA-MM-DD',
  })
  eventDate?: string;
}
