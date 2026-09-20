import { Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { StockModelMigration } from './stock-model-migration.service';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, StockModelMigration],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
