// Tipos compartidos del dominio, espejo de los modelos de Prisma (backend/prisma/schema.prisma).

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  /** Posición en el catálogo: menor número primero. */
  sortOrder?: number;
  products?: Product[];
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  /** Inventario FÍSICO: cuántas unidades tiene el negocio en total. */
  totalStock: number;
  /** Unidades libres HOY (se calcula en el servidor desde los alquileres activos). Solo lo trae el listado del panel. */
  availableStock?: number;
  /** Unidades ocupadas HOY (total - libres hoy). */
  rentedCount?: number;
  /** Si la demanda de las próximas semanas va a dejar pocas unidades libres (ver AvailabilityService.withAvailability). */
  lowStock?: boolean;
  pricePerDay: number;
  categoryId: number;
  category?: Category;
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface City {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  /** Km por ruta desde el local (null = sin cargar). */
  distanceKm?: number | null;
  /** true: el precio lo calcula la fórmula de envío; false: puesto a mano. */
  priceFromFormula?: boolean;
  /** price = 0 por estar dentro del radio de envío gratis (si no, 0 = a coordinar). */
  freeShipping?: boolean;
}

/** Fórmula del costo de envío por km (GET/PUT /shipping/settings). */
export interface ShippingSettings {
  pricePerKm: number;
  freeUnderKm: number;
  longDistanceFromKm: number;
  longDistancePricePerKm: number;
  /** null = sin límite. */
  maxKm: number | null;
  roundTo: number;
}

export interface RentalItem {
  id: number;
  quantity: number;
  unitPrice?: number | null;
  rentalId: number;
  productId: number;
  product?: Product;
}

// PRESUPUESTO = cotización sin confirmar (no ocupa stock ni suma ingresos).
// ACTIVO = vigente (reservado, en uso o atrasado según las fechas). Solo los ACTIVO ocupan unidades.
export type RentalStatus = "PRESUPUESTO" | "ACTIVO" | "DEVUELTO" | "CANCELADO";
export type RentalPhase = "PRESUPUESTO" | "RESERVADO" | "EN_USO" | "ATRASADO" | "DEVUELTO" | "CANCELADO";

/** Lo mínimo de una factura que viaja con cada alquiler (para mostrar su número o el botón "Realizar factura"). */
export interface RentalInvoiceSummary {
  id: number;
  establishment: string;
  expeditionPoint: string;
  number: number;
  status: InvoiceStatus;
  environment: InvoiceEnvironment;
}

export interface Rental {
  id: number;
  clientName: string;
  clientPhone?: string | null;
  eventDate: string;
  returnDate: string;
  status: RentalStatus;
  /** Etapa calculada por fecha en el servidor (no se guarda). */
  phase?: RentalPhase;
  /** Días de atraso: solo > 0 cuando phase es ATRASADO. */
  daysOverdue?: number;
  returnedAt?: string | null;
  cancelledAt?: string | null;
  /** Productos + envío. El envío queda congelado al precio de la ciudad en el momento de elegirla. */
  totalPrice: number;
  shippingPrice?: number;
  createdAt: string;
  updatedAt: string;
  cityId?: number | null;
  city?: City | null;
  items: RentalItem[];
  /** Facturas emitidas por este alquiler, la más nueva primero. */
  invoices?: RentalInvoiceSummary[];
}

// ==========================================
// FACTURACIÓN ELECTRÓNICA
// ==========================================

export type InvoiceStatus = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "ANULADA";
/** PRUEBA = sin validez fiscal (todavía sin conexión con la DNIT). */
export type InvoiceEnvironment = "PRUEBA" | "PRODUCCION";
export type CustomerType = "RUC" | "CI" | "SIN_NOMBRE";
export type IvaRate = 10 | 5 | 0;

/** Datos del emisor que salen impresos en la factura (GET/PUT /invoices/settings). */
export interface InvoiceSettings {
  businessName: string;
  tradeName: string;
  slogan: string;
  ruc: string;
  /** Actividades económicas, una por línea. */
  activities: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  establishment: string;
  expeditionPoint: string;
  /** Timbrado electrónico (vacío = todavía sin habilitar). */
  timbrado: string;
  timbradoStart: string | null;
}

export interface InvoiceSettingsView {
  settings: InvoiceSettings;
  provider: { isTest: boolean; label: string };
}

/** Copia de los datos del emisor guardada en cada factura al emitirla. */
export type InvoiceIssuer = Omit<InvoiceSettings, "establishment" | "expeditionPoint" | "timbrado">;

export interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  ivaRate: IvaRate;
  total: number;
  productId?: number | null;
}

export interface Invoice {
  id: number;
  environment: InvoiceEnvironment;
  timbrado: string;
  establishment: string;
  expeditionPoint: string;
  number: number;
  issuedAt: string;
  condition: "CONTADO" | "CREDITO";
  customerType: CustomerType;
  customerDocument: string | null;
  customerName: string;
  customerAddress: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  total: number;
  taxed10: number;
  taxed5: number;
  exempt: number;
  iva10: number;
  iva5: number;
  status: InvoiceStatus;
  cdc: string | null;
  qrUrl: string | null;
  statusMessage: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  issuer: InvoiceIssuer;
  rentalId: number | null;
  createdBy?: { name: string } | null;
  items: InvoiceItem[];
}

export interface GalleryImage {
  id: number;
  imageUrl: string;
  title?: string | null;
  // Ver lib/gallery.ts para la lista válida. null = sin clasificar (fotos
  // subidas antes de que existiera este campo).
  eventType?: string | null;
  isVisible: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutIntentItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
}

// Pedido por WhatsApp (se registra cuando el cliente aprieta "Enviar pedido"
// en el carrito). "Pendiente" = todavía sin revisar; el panel lo muestra en
// Alquileres para convertirlo en un alquiler real o descartarlo.
export interface CheckoutIntent {
  id: number;
  totalAmount: number;
  itemCount: number;
  cityName?: string | null;
  cityId?: number | null;
  eventDate?: string | null;
  returnDate?: string | null;
  createdAt: string;
  items: CheckoutIntentItem[];
}
