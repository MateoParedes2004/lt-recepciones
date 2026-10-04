import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { CategoryOrderMigration } from './category-order-migration.service';

@Module({
  providers: [CategoriesService, CategoryOrderMigration],
  controllers: [CategoriesController]
})
export class CategoriesModule {}
