"use client";

import { useState } from "react";
import { ShoppingCart, Check, X, Minus, Plus } from "lucide-react";
import { useCart } from "./CartProvider";

export default function AddToCartButton({ product }: { product: any }) {
  const { addToCart } = useCart();
  
  const [showSelector, setShowSelector] = useState(false);
  const [quantity, setQuantity] = useState<number | string>(1);

  const handleConfirm = () => {
    const finalQuantity = Number(quantity) || 1;
    addToCart(product, finalQuantity);
    
    setShowSelector(false);
    setQuantity(1);
  };

  const handleDecrease = () => {
    const current = Number(quantity) || 1;
    if (current > 1) setQuantity(current - 1);
  };

  const handleIncrease = () => {
    const current = Number(quantity) || 1;
    if (current < product.totalStock) setQuantity(current + 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      setQuantity("");
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num > product.totalStock) {
        setQuantity(product.totalStock);
      } else {
        setQuantity(num);
      }
    }
  };

  const handleBlur = () => {
    const num = Number(quantity);
    if (!quantity || isNaN(num) || num < 1) {
      setQuantity(1);
    }
  };

  return (
    <div className="relative flex justify-end w-full">
      {/* BOTÓN ORIGINAL */}
      <button 
        onClick={() => setShowSelector(true)}
        disabled={product.totalStock <= 0}
        className="flex items-center justify-center text-sm font-bold bg-blue-50 text-blue-900 border border-blue-100 px-4 py-2 rounded-lg hover:bg-blue-900 hover:text-white transition-colors duration-300 cursor-pointer shadow-sm w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ShoppingCart className="w-4 h-4 mr-1.5" /> 
        {product.totalStock <= 0 ? "Agotado" : "Agregar"}
      </button>

      {/* TARJETITA FLOTANTE (Ahora más compacta: w-48) */}
      {showSelector && (
        <div className="absolute bottom-0 right-0 w-48 sm:w-52 bg-white border border-slate-200 shadow-2xl rounded-xl p-3 z-50 flex flex-col gap-3 transform origin-bottom-right transition-all duration-200">
          
          {/* Cabecera */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-800 leading-tight">Cantidad</span>
              <span className="text-xs text-slate-500 mt-0.5">
                Stock: <strong className="text-blue-900">{product.totalStock}</strong>
              </span>
            </div>
            <button 
              onClick={() => {
                setShowSelector(false);
                setQuantity(1);
              }} 
              className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-full p-1 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Selector de Cantidad */}
          <div className="flex items-center justify-between border-2 border-slate-100 focus-within:border-blue-900 transition-colors rounded-lg bg-white p-1">
            <button 
              onClick={handleDecrease} 
              disabled={(Number(quantity) || 1) <= 1}
              className="p-1 text-slate-500 hover:text-blue-900 hover:bg-blue-50 rounded-md disabled:opacity-30 transition-colors cursor-pointer shrink-0"
            >
              <Minus className="w-4 h-4" />
            </button>
            
            <input 
              type="number" 
              min="1"
              max={product.totalStock}
              value={quantity}
              onChange={handleInputChange}
              onBlur={handleBlur}
              className="w-10 text-center text-sm font-bold text-slate-900 bg-transparent focus:outline-none hide-arrows"
              style={{ MozAppearance: 'textfield' }}
            />
            
            <button 
              onClick={handleIncrease} 
              disabled={(Number(quantity) || 1) >= product.totalStock}
              className="p-1 text-slate-500 hover:text-blue-900 hover:bg-blue-50 rounded-md disabled:opacity-30 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Botón de Confirmación */}
          <button 
            onClick={handleConfirm}
            className="w-full bg-blue-900 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-800 flex justify-center items-center shadow-md transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 mr-1.5" /> Confirmar
          </button>
        </div>
      )}

      {/* CSS para ocultar flechitas */}
      <style jsx global>{`
        .hide-arrows::-webkit-outer-spin-button,
        .hide-arrows::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
}