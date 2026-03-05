"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "./CartProvider";

export default function AddToCartButton({ product }: { product: any }) {
  const { addToCart } = useCart();

  return (
    <button 
      onClick={() => addToCart(product)}
      className="flex items-center justify-center text-sm font-bold bg-blue-50 text-blue-900 border border-blue-100 px-4 py-2 rounded-lg hover:bg-blue-900 hover:text-white transition-colors duration-300 cursor-pointer shadow-sm"
    >
      <ShoppingCart className="w-4 h-4 mr-1.5" /> Agregar
    </button>
  );
}