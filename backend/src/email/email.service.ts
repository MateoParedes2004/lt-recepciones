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

// cityName viene del carrito público (sin login): hay que escaparlo antes de
// meterlo en el HTML del mail, igual que cualquier otro texto no confiable
// que termine en una página/documento que se renderiza.
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

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

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    this.resend = apiKey ? new Resend(apiKey) : null;

    // Se avisa UNA VEZ al arrancar (no recién cuando llega el primer pedido):
    // así una variable mal cargada en Render se nota enseguida en los logs,
    // en vez de descubrirse semanas después porque nunca llegó ningún mail.
    if (!this.resend && !this.adminEmail) {
      this.logger.warn(
        'RESEND_API_KEY y ADMIN_NOTIFY_EMAIL no configuradas: el aviso por mail de pedidos nuevos queda desactivado (el pedido igual se guarda y aparece en el panel).',
      );
    } else if (!this.resend) {
      this.logger.warn(
        'Falta RESEND_API_KEY: el aviso por mail de pedidos nuevos no va a mandarse aunque ADMIN_NOTIFY_EMAIL sí esté configurada.',
      );
    } else if (!this.adminEmail) {
      this.logger.warn(
        'Falta ADMIN_NOTIFY_EMAIL: el aviso por mail de pedidos nuevos no va a mandarse aunque RESEND_API_KEY sí esté configurada.',
      );
    } else {
      this.logger.log(
        `Aviso por mail de pedidos nuevos activado (se manda a ${this.adminEmail}).`,
      );
    }
  }

  async notifyNewOrder(order: NewOrderEmailData): Promise<void> {
    if (!this.resend || !this.adminEmail) return;

    const itemsHtml = order.items
      .map((i) => `<li>${i.quantity}x ${escapeHtml(i.productName)}</li>`)
      .join('');
    const dateLine =
      order.eventDate && order.returnDate
        ? `${formatDayIndex(toDayIndex(order.eventDate))} al ${formatDayIndex(toDayIndex(order.returnDate))}`
        : 'Sin fecha indicada';
    const cityLine = order.cityName
      ? escapeHtml(order.cityName)
      : 'Sin especificar';

    try {
      await this.resend.emails.send({
        from: 'LT Recepciones <onboarding@resend.dev>',
        to: this.adminEmail,
        subject: `Nuevo pedido por WhatsApp: ${formatPYG(order.totalAmount)}`,
        html: `
          <h2>Nuevo pedido por WhatsApp</h2>
          <p><strong>Total estimado:</strong> ${formatPYG(order.totalAmount)}</p>
          <p><strong>Fechas:</strong> ${dateLine}</p>
          <p><strong>Ciudad:</strong> ${cityLine}</p>
          <p><strong>Productos:</strong></p>
          <ul>${itemsHtml}</ul>
          <p>Respondé al cliente por WhatsApp como siempre. Cuando cierren el trato, confirmalo desde el panel en Alquileres, en el cartel "Pedidos nuevos por WhatsApp" (ya va a estar precargado con estos datos).</p>
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
