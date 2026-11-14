import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import {
  INVOICE_PROVIDER,
  InvoiceProvider,
} from './providers/invoice-provider';
import { TestInvoiceProvider } from './providers/test-invoice.provider';

// Qué proveedor firma y envía las facturas a la DNIT. Por ahora solo existe
// "prueba"; el proveedor real se agrega acá cuando se contrate.
function createInvoiceProvider(): InvoiceProvider {
  const name = (process.env.INVOICE_PROVIDER || 'prueba').toLowerCase();
  if (name === 'prueba') return new TestInvoiceProvider();
  throw new Error(
    `INVOICE_PROVIDER="${name}" no existe. Valores posibles: prueba.`,
  );
}

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    { provide: INVOICE_PROVIDER, useFactory: createInvoiceProvider },
  ],
})
export class InvoicesModule {}
