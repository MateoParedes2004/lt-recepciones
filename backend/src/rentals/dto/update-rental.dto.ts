import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateRentalDto } from './create-rental.dto';

// Todos los campos opcionales: solo se cambia lo que se envía. Un presupuesto
// pasa a alquiler con PATCH :id/confirm, no editándolo.
export class UpdateRentalDto extends PartialType(OmitType(CreateRentalDto, ['asQuote'] as const)) {}
