import { Controller, Get, Post, Body, Param, Put, Query, UseGuards } from '@nestjs/common';
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
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.rentalsService.findAll(page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  @Put(':id/return')
  markAsReturned(@Param('id') id: string) {
    return this.rentalsService.markAsReturned(Number(id));
  }
}