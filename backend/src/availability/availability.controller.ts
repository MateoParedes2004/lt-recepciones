import { Controller, Get, Query } from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { AvailabilityService } from './availability.service';

export class AvailabilityQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  // Público: lo usa el carrito para saber cuánto hay libre en las fechas que
  // el cliente eligió. Devuelve, por producto, las unidades libres durante
  // TODO el rango (el mínimo de cualquier día).
  @Get()
  async forRange(@Query() query: AvailabilityQueryDto) {
    const { from, to } = this.availability.parseRange(query.from, query.to);
    return { products: await this.availability.availabilityForRange(from, to) };
  }
}
