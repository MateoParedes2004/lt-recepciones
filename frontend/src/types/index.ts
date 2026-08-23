// Tipos compartidos del dominio, espejo de los modelos de Prisma (backend/prisma/schema.prisma).

export interface Category {
  id: number;
  name: string;
  products?: Product[];
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  totalStock: number;
  rentedCount: number;
  pricePerDay: number;
  categoryId: number;
  category?: Category;
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
  rentalId: number;
  productId: number;
  product?: Product;
}

export interface Rental {
  id: number;
  clientName: string;
  clientPhone?: string | null;
  eventDate: string;
  returnDate: string;
  status: "ACTIVO" | "DEVUELTO";
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
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
