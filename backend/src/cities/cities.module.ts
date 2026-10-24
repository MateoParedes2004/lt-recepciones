import { Module } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { CitiesController } from './cities.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ShippingSettingsService } from './shipping-settings.service';
import { ShippingSettingsController } from './shipping-settings.controller';
import { CityDistanceMigration } from './city-distance-migration.service';

@Module({
  imports: [PrismaModule],
  controllers: [CitiesController, ShippingSettingsController],
  providers: [CitiesService, ShippingSettingsService, CityDistanceMigration],
})
export class CitiesModule {}
