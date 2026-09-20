import { Controller, Get, Post, Body, Param, Put, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRentalDto } from './dto/create-rental.dto';

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

  @Put(':id/return')
  markAsReturned(@Param('id', ParseIntPipe) id: number) {
    return this.rentalsService.markAsReturned(id);
  }
}