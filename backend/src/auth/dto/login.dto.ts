import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  // El correo no distingue mayúsculas (los teclados del celular suelen poner la primera en mayúscula).
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Escribí un correo válido.' })
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  // "Recordarme en este dispositivo": la sesión dura 30 días en vez de 1.
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
