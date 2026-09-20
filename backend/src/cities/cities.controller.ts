import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@Controller('cities')
export class CitiesController {
    constructor(private readonly citiesService: CitiesService) {}

    // 1. OBTENER CIUDADES (GET /cities) — público, lo usa el selector de envío del carrito
    @Get()
    async findAll() {
        return this.citiesService.getCities();
    }

    // 2. CREAR CIUDAD (POST /cities)
    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Body() createCityDto: CreateCityDto) {
        return this.citiesService.createCity(createCityDto);
    }

    // 3. ACTUALIZAR CIUDAD (PATCH /cities/:id)
    @UseGuards(JwtAuthGuard)
    @Patch(':id')
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateCityDto: UpdateCityDto
    ) {
        return this.citiesService.updateCity(id, updateCityDto);
    }

    // 4. ELIMINAR CIUDAD (DELETE /cities/:id)
    @UseGuards(JwtAuthGuard)
    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.citiesService.deleteCity(id);
    }
}