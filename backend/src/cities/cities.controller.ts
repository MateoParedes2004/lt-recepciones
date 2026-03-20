import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CitiesService } from './cities.service';

@Controller('cities')
export class CitiesController {
    constructor(private readonly citiesService: CitiesService) {}

    // 1. OBTENER CIUDADES (GET /cities)
    @Get()
    async findAll() {
        return this.citiesService.getCities();
    }

    // 2. CREAR CIUDAD (POST /cities)
    // Usamos @Body para atrapar los datos (nombre y precio) que envía el frontend
    @Post()
    async create(@Body() createCityDto: { name: string; price: number }) {
        return this.citiesService.createCity(createCityDto);
    }

    // 3. ACTUALIZAR CIUDAD (PATCH /cities/:id)
    // Usamos @Param para obtener el ID de la URL y @Body para los datos a cambiar
    @Patch(':id')
    async update(
        @Param('id') id: string, 
        @Body() updateCityDto: { name?: string; price?: number; isActive?: boolean }
    ) {
        // Convertimos el ID de string a número con Number() o con un + 
        return this.citiesService.updateCity(Number(id), updateCityDto);
    }

    // 4. ELIMINAR CIUDAD (DELETE /cities/:id)
    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.citiesService.deleteCity(Number(id));
    }
}