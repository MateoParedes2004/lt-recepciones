import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { formatDayIndex, toDayIndex } from '../common/timezone';

export interface NewOrderEmailData {
  id: number;
  totalAmount: number;
  cityName: string | null;
  eventDate: Date | null;
  returnDate: Date | null;
  items: { productName: string; quantity: number }[];
}

const formatPYG = (amount: number) =>
  `Gs. ${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/**
 * Avisa por mail cuando llega un pedido nuevo por WhatsApp (ver
 * AnalyticsService.registrarCheckoutIntent). Usa Resend porque mandar desde
 * Gmail directo con nodemailer es poco confiable para correo automático
 * (terminan en spam o Gmail lo bloquea). Sin RESEND_API_KEY configurada, no
 * manda nada pero tampoco rompe nada: el pedido se sigue guardando igual y
 * aparece en el panel — el mail es un aviso extra, no la fuente de verdad.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly adminEmail?: string;
  private warnedMissingConfig = false;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async notifyNewOrder(order: NewOrderEmailData): Promise<void> {
    if (!this.resend || !this.adminEmail) {
      if (!this.warnedMissingConfig) {
        this.warnedMissingConfig = true;
        this.logger.warn(
          'RESEND_API_KEY o ADMIN_NOTIFY_EMAIL no configurados: no se manda el aviso por mail de pedidos nuevos (el pedido igual se guarda y aparece en el panel).',
        );
      }
      return;
    }

    const itemsHtml = order.items
      .map((i) => `<li>${i.quantity}x ${i.productName}</li>`)
      .join('');
    const dateLine =
      order.eventDate && order.returnDate
        ? `${formatDayIndex(toDayIndex(order.eventDate))} al ${formatDayIndex(toDayIndex(order.returnDate))}`
        : 'Sin fecha indicada';

    try {
      await this.resend.emails.send({
        from: 'LT Recepciones <onboarding@resend.dev>',
        to: this.adminEmail,
        subject: `Nuevo pedido por WhatsApp: ${formatPYG(order.totalAmount)}`,
        html: `
          <h2>Nuevo pedido por WhatsApp</h2>
          <p><strong>Total estimado:</strong> ${formatPYG(order.totalAmount)}</p>
          <p><strong>Fechas:</strong> ${dateLine}</p>
          <p><strong>Ciudad:</strong> ${order.cityName ?? 'Sin especificar'}</p>
          <p><strong>Productos:</strong></p>
          <ul>${itemsHtml}</ul>
          <p>Respondé al cliente por WhatsApp como siempre. Cuando cierren el trato, confirmalo desde el panel en "Alquileres → Pedidos por confirmar" (ya va a estar precargado con estos datos).</p>
        `,
      });
    } catch (error) {
      // Nunca debe tirar abajo el registro del pedido: es un aviso, no la fuente de verdad.
      this.logger.error(
        `No se pudo mandar el aviso por mail del pedido #${order.id}.`,
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
