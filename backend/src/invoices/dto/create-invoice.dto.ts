import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { cleanText, trimString } from '../../common/trim';

export const CUSTOMER_TYPES = ['RUC', 'CI', 'SIN_NOMBRE'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export class InvoiceLineDto {
  @Transform(cleanText)
  @IsString()
  @MinLength(1)
  // 150 = el largo máximo del nombre de un producto, para poder facturar cualquiera.
  @MaxLength(150)
  description: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  // Guaraníes enteros, IVA incluido. 0 se permite (ej. un ítem bonificado).
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitPrice: number;

  @IsIn([10, 5, 0])
  ivaRate: 10 | 5 | 0;

  @IsOptional()
  @IsInt()
  productId?: number;
}

export class CreateInvoiceDto {
  // Alquiler que se está facturando (opcional: también se puede facturar algo suelto).
  @IsOptional()
  @IsInt()
  rentalId?: number;

  @IsIn(['CONTADO', 'CREDITO'])
  condition: 'CONTADO' | 'CREDITO';

  @IsIn(CUSTOMER_TYPES)
  customerType: CustomerType;

  // RUC con dígito verificador ("80038950-6") o número de cédula. Lo valida el servicio según el tipo.
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(20)
  customerDocument?: string;

  @Transform(cleanText)
  @IsString()
  @MaxLength(150)
  customerName: string;

  @IsOptional()
  @Transform(cleanText)
  @IsString()
  @MaxLength(200)
  customerAddress?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsEmail({}, { message: 'El correo del cliente no es válido.' })
  @MaxLength(120)
  customerEmail?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  customerPhone?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'La factura necesita al menos una línea.' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  items: InvoiceLineDto[];
}
