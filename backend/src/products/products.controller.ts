import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
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
      rentedCount: 0,
      imageUrl: imageUrl, // Guardamos el link de internet en la Base de Datos
    };

    return this.productsService.createProduct(productData);
  }

  @Get()
  getAllProducts(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.productsService.getAllProducts(page ? Number(page) : undefined, limit ? Number(limit) : undefined);
  }

  @Get(':id')
  getProductById(@Param('id') id: string) {
    return this.productsService.getProductById(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @UseInterceptors(FileInterceptor('image', multerImageOptions))
  async updateProduct(@Param('id') id: string, @Body() body: UpdateProductDto, @UploadedFile() file: Express.Multer.File) {
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

    return this.productsService.updateProduct(Number(id), productData);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteProduct(@Param('id') id: string) {
    return this.productsService.deleteProduct(Number(id));
  }
}