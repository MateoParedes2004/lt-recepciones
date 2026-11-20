import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { cleanLabel, emptyToNull, trimString } from '../../common/trim';

// AAAA-MM-DD puro, opcionalmente con la medianoche UTC exacta que produce
// `new Date(...).toISOString()` (el panel siempre manda esa forma). Todo el
// cálculo de disponibilidad (ver common/timezone.ts) asume que estas fechas
// son medianoche UTC; @IsDateString() de class-validator aceptaba cualquier
// ISO 8601 válido, incluida una hora u offset distintos, que correrían el
// día calculado si algo aparte del panel llegara a mandar uno.
const FECHA_CALENDARIO = /^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/;

// Hora del día "HH:MM" (00:00 a 23:59).
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

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

  // Color que eligió el cliente (opcional, ej. "Negro"). Solo vale para
  // manteles y servilletas: el servidor lo rechaza en cualquier otro
  // (ver RentalsService.assertColors). Vacío = sin color elegido todavía.
  @IsOptional()
  @Transform(cleanLabel)
  @IsString()
  @MaxLength(40)
  color?: string | null;
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

  // Lugar exacto de entrega (ver el schema). Latitud y longitud van juntas;
  // null = quitar la ubicación al editar. Los km se calculan con
  // POST /routing/locate y se guardan tal cual (como shippingPrice).
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng?: number | null;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(300)
  deliveryAddress?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  deliveryKm?: number | null;

  // Horario en que el cliente espera la entrega y el retiro ("HH:MM", hora de
  // Paraguay). null o "" = sin horario. Lo usa el planificador de rutas.
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(HORA, { message: 'deliveryWindowFrom debe tener formato HH:MM' })
  deliveryWindowFrom?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(HORA, { message: 'deliveryWindowTo debe tener formato HH:MM' })
  deliveryWindowTo?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(HORA, { message: 'pickupWindowFrom debe tener formato HH:MM' })
  pickupWindowFrom?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(HORA, { message: 'pickupWindowTo debe tener formato HH:MM' })
  pickupWindowTo?: string | null;

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
  // marcarlo CONFIRMADO (atendido) y enlazarlo con el alquiler recién creado,
  // que puede ser un alquiler confirmado o un presupuesto (asQuote).
  @IsOptional()
  @IsInt()
  checkoutIntentId?: number;

  // true = se guarda como PRESUPUESTO: no reserva stock ni cuenta en ingresos
  // hasta que se confirma (PATCH /rentals/:id/confirm).
  @IsOptional()
  @IsBoolean()
  asQuote?: boolean;
}
