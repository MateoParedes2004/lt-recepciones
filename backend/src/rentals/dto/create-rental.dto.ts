import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
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

  // Precio unitario real de esta cotización: puede diferir del catálogo
  // (descuentos, recargos, acuerdos puntuales). Si no se manda, el servidor
  // usa el precio histórico de ese producto en el alquiler, o el vigente si
  // es nuevo (ver RentalsService "priceFor").
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice?: number;
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

  // Costo de envío real de esta cotización: puede diferir del que tiene
  // cargado la ciudad (varía según la dirección exacta, el tamaño del
  // pedido, etc.). Si no se manda, el servidor usa el precio de la ciudad elegida.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000)
  shippingPrice?: number;

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

  // Si este alquiler viene de confirmar un pedido por WhatsApp (ver
  // "Pedidos por confirmar" en el panel), el id de ese CheckoutIntent para
  // marcarlo CONFIRMADO y enlazarlo con el alquiler recién creado.
  @IsOptional()
  @IsInt()
  checkoutIntentId?: number;
}
