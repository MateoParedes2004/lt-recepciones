import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShippingSettingsDto } from './dto/shipping-settings.dto';
import { ShippingSettingsService } from './shipping-settings.service';

@UseGuards(JwtAuthGuard)
@Controller('shipping/settings')
export class ShippingSettingsController {
  constructor(private readonly shipping: ShippingSettingsService) {}

  @Get()
  get() {
    return this.shipping.get();
  }

  @Put()
  update(@Body() dto: ShippingSettingsDto) {
    return this.shipping.update(dto);
  }
}
