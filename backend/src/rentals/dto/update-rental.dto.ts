import { PartialType } from '@nestjs/mapped-types';
import { CreateRentalDto } from './create-rental.dto';

// Todos los campos opcionales: solo se cambia lo que se envía.
export class UpdateRentalDto extends PartialType(CreateRentalDto) {}
