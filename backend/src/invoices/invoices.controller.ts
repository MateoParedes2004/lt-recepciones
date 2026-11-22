import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard';
import { AllowRoles } from '../auth/roles';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceSettingsDto } from './dto/invoice-settings.dto';
import { CancelInvoiceDto } from './dto/cancel-invoice.dto';

// Emitir, reintentar y anular facturas: también el Vendedor.
@UseGuards(JwtAuthGuard)
@AllowRoles('VENDEDOR')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  findAll() {
    return this.invoices.findAll();
  }

  @Get('settings')
  getSettings() {
    return this.invoices.getSettingsView();
  }

  // Datos del emisor (RUC, timbrado…): solo el dueño.
  @AllowRoles()
  @Put('settings')
  updateSettings(@Body() dto: InvoiceSettingsDto) {
    return this.invoices.updateSettings(dto);
  }

  @Post()
  create(
    @Body() dto: CreateInvoiceDto,
    @Req() req: Request & { user: AuthenticatedUser },
  ) {
    return this.invoices.create(dto, req.user.sub);
  }

  @Post(':id/retry')
  retry(@Param('id', ParseIntPipe) id: number) {
    return this.invoices.retry(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelInvoiceDto) {
    return this.invoices.cancel(id, dto.reason);
  }
}
