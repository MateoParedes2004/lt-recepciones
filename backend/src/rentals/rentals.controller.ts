import { Controller, Get, Post, Body, Param, Put, Patch, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRentalDto } from './dto/create-rental.dto';
import { UpdateRentalDto } from './dto/update-rental.dto';
import { RentalAvailabilityQueryDto } from './dto/availability-query.dto';

// Todo el módulo de alquileres es de uso exclusivo del panel admin
// (el checkout público no pasa por el backend, redirige a WhatsApp).
@UseGuards(JwtAuthGuard)
@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Post()
  create(@Body() data: CreateRentalDto) {
    return this.rentalsService.create(data);
  }

  @Get()
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.rentalsService.findAll(page, limit);
  }

  // Unidades libres por producto en un rango de fechas. Con excludeRentalId
  // no cuenta ese alquiler (para editarlo sin chocar consigo mismo).
  @Get('availability')
  availability(@Query() query: RentalAvailabilityQueryDto) {
    return this.rentalsService.availabilityForRange(query.from, query.to, query.excludeRentalId);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: UpdateRentalDto) {
    return this.rentalsService.update(id, data);
  }

  @Put(':id/return')
  markAsReturned(@Param('id', ParseIntPipe) id: number) {
    return this.rentalsService.markAsReturned(id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number) {
    return this.rentalsService.cancel(id);
  }

  @Patch(':id/reopen')
  reopen(@Param('id', ParseIntPipe) id: number) {
    return this.rentalsService.reopen(id);
  }
}
