import { IsOptional, IsString, MaxLength } from 'class-validator';

// Antes el título se leía directo del body sin pasar por un DTO: a diferencia
// del resto de los endpoints de escritura del backend, no tenía ni chequeo de
// tipo ni límite de tamaño.
export class CreateGalleryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}
