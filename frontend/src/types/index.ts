// Tipos compartidos del dominio, espejo de los modelos de Prisma (backend/prisma/schema.prisma).

export interface Category {
  id: number;
  name: string;
  description?: string | null;
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
  totalPrice: number;
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
  isVisible: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
