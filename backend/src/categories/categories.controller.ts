import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // El DTO (con whitelist y forbidNonWhitelisted globales) define exactamente
  // qué campos acepta una categoría: name y description.
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateCategoryDto) {
    return this.categoriesService.create(body);
  }

  // Lectura pública del catálogo: sin límite por IP. Las páginas del sitio se
  // arman en los servidores de Vercel, que comparten unas pocas IPs: con el
  // límite general, Google recorriendo muchas fichas a la vez podía agotarlo
  // y dejar páginas guardadas en caché sin productos.
  @SkipThrottle()
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @SkipThrottle()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCategoryDto) {
    return this.categoriesService.update(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}