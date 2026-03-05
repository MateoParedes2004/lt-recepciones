import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Body() body: any) {
    // 🛡️ FILTRO DE SEGURIDAD: Solo pasamos el nombre a la base de datos.
    // Ignoramos la 'description' porque la tabla Category no la soporta actualmente.
    const safeData = {
      name: body.name
    };
    return this.categoriesService.create(safeData);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    // 🛡️ FILTRO DE SEGURIDAD: También filtramos al actualizar.
    const safeData = {
      name: body.name
    };
    return this.categoriesService.update(Number(id), safeData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(Number(id));
  }
}