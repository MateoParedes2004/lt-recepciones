import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { RentalsService } from './rentals.service';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  @Post()
  create(@Body() data: any) {
    return this.rentalsService.create(data);
  }

  @Get()
  findAll() {
    return this.rentalsService.findAll();
  }

  @Put(':id/return')
  markAsReturned(@Param('id') id: string) {
    return this.rentalsService.markAsReturned(Number(id));
  }
}