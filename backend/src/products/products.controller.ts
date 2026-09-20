import { Controller, Get, Post, Body, Param, Put, Patch, Delete, Query, ParseIntPipe, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { FileInterceptor } from '@nestjs/platform-express';
// 👇 1. Importamos el nuevo servicio de Cloudinary
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { multerImageOptions } from '../common/multer-image.config';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    // 👇 2. Inyectamos Cloudinary en el constructor
    private readonly cloudinaryService: CloudinaryService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('image', multerImageOptions))
  async createProduct(@Body() body: CreateProductDto, @UploadedFile() file: Express.Multer.File) {
    let imageUrl = null;

    // 👇 3. Si hay un archivo, lo subimos a la nube
    if (file) {
      const cloudRes = await this.cloudinaryService.uploadImage(file);
      imageUrl = cloudRes.secure_url; // Extraemos el link seguro (https)
    }

    const productData = {
      name: body.name,
      description: body.description,
      pricePerDay: body.pricePerDay,
      categoryId: body.categoryId,
      totalStock: body.totalStock ?? 0,
      imageUrl: imageUrl, // Guardamos el link de internet en la Base de Datos
    };

    try {
      return await this.productsService.createProduct(productData);
    } catch (error) {
      // La foto ya se subió: si el guardado falla (ej. categoría inexistente)
      // la liberamos, para no dejar archivos huérfanos en Cloudinary.
      await this.cloudinaryService.deleteByUrl(imageUrl);
      throw error;
    }
  }

  @Get()
  getAllProducts(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.productsService.getAllProducts(page, limit);
  }

  // Productos dados de baja (archivados). Va ANTES de ':id': si no, Express
  // interpretaría "archived" como un id.
  @UseGuards(JwtAuthGuard)
  @Get('archived')
  getArchivedProducts() {
    return this.productsService.getArchivedProducts();
  }

  @Get(':id')
  getProductById(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getProductById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @UseInterceptors(FileInterceptor('image', multerImageOptions))
  async updateProduct(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateProductDto, @UploadedFile() file: Express.Multer.File) {
    const productData: UpdateProductDto & { imageUrl?: string } = {
      name: body.name,
      description: body.description,
      pricePerDay: body.pricePerDay,
      categoryId: body.categoryId,
      totalStock: body.totalStock,
    };

    // 👇 4. Si el usuario sube una FOTO NUEVA al editar, la subimos a la nube y reemplazamos el link
    if (file) {
      const cloudRes = await this.cloudinaryService.uploadImage(file);
      productData.imageUrl = cloudRes.secure_url;
    }

    try {
      return await this.productsService.updateProduct(id, productData);
    } catch (error) {
      // Igual que al crear: si la edición falla, la foto nueva no queda huérfana.
      await this.cloudinaryService.deleteByUrl(productData.imageUrl);
      throw error;
    }
  }

  // Vuelve a dar de alta un producto archivado: reaparece en el catálogo y en
  // el selector de "Nuevo Alquiler" con su historial intacto.
  @UseGuards(JwtAuthGuard)
  @Patch(':id/restore')
  restoreProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.restoreProduct(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deleteProduct(id);
  }
}