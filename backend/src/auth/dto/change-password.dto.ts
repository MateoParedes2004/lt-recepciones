import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8, {
    message: 'La contraseña nueva tiene que tener al menos 8 caracteres.',
  })
  @MaxLength(72, {
    message: 'La contraseña nueva puede tener hasta 72 caracteres.',
  })
  newPassword: string;
}
