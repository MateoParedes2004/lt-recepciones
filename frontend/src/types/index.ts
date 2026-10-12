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
}

export interface RentalItem {
  id: number;
  quantity: number;
  unitPrice?: number | null;
  rentalId: number;
  productId: number;
  product?: Product;
}

// ACTIVO = vigente (reservado, en uso o atrasado según las fechas). Solo los ACTIVO ocupan unidades.
export type RentalStatus = "ACTIVO" | "DEVUELTO" | "CANCELADO";
export type RentalPhase = "RESERVADO" | "EN_USO" | "ATRASADO" | "DEVUELTO" | "CANCELADO";

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
