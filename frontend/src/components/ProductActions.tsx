"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBag, CheckCircle2, AlertCircle } from "lucide-react"; // 👇 Agregamos AlertCircle
import { useCart } from "./CartProvider"; 

export default function ProductActions({ product }: { product: any }) {
  const [quantity, setQuantity] = useState<number | string>(1);
  const [addedQty, setAddedQty] = useState(1);
  
  // Estados para Animaciones
  const [isVisible, setIsVisible] = useState(false);
  const [isSlidIn, setIsSlidIn] = useState(false);
  
  // 👇 NUEVO: Estado para controlar la tarjeta roja de error
  const [stockError, setStockError] = useState(false);
  
  const { addToCart } = useCart(); 

  const isOutOfStock = product.totalStock <= 0;

  // Función para mostrar el error temporalmente
  const showStockError = () => {
    setStockError(true);
    // Ocultar la tarjeta automáticamente después de 4 segundos
    setTimeout(() => {
      setStockError(false);
    }, 4000);
  };

  const handleDecrease = () => {
    const current = Number(quantity) || 1;
    if (current > 1) {
      setQuantity(current - 1);
      setStockError(false); // Ocultamos el error si baja la cantidad
    }
  };

  const handleIncrease = () => {
    const current = Number(quantity) || 1;
    if (current < product.totalStock) {
      setQuantity(current + 1);
      setStockError(false);
    } else {
      showStockError(); // Si intenta subir más del stock, mostramos error
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    if (val === "") {
      setQuantity("");
      setStockError(false);
      return;
    }
    
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      if (num > product.totalStock) {
        setQuantity(product.totalStock); // Ajustamos al máximo
        showStockError();                // 👇 Disparamos la tarjeta roja
      } else {
        setQuantity(num);
        setStockError(false);
      }
    }
  };

  const handleBlur = () => {
    const num = Number(quantity);
    if (!quantity || isNaN(num) || num < 1) {
      setQuantity(1);
      setStockError(false);
    }
  };

  const handleAddToCart = () => {
    const finalQuantity = Number(quantity) || 1;
    
    addToCart(product, finalQuantity);
    setAddedQty(finalQuantity);

    setIsVisible(true);
    setIsSlidIn(false);

    setTimeout(() => {
      setIsSlidIn(true);
    }, 50);

    setTimeout(() => {
      setIsSlidIn(false);
    }, 2500);

    setTimeout(() => {
      setIsVisible(false);
    }, 3000);
    
    setQuantity(1);
    setStockError(false);
  };

  if (isOutOfStock) {
     return (
       <div className="mt-6">
         <button disabled className="w-full bg-slate-100 text-slate-400 border border-slate-200 rounded-2xl py-4 px-6 font-bold flex justify-center items-center cursor-not-allowed">
           Agotado momentáneamente
         </button>
       </div>
     );
  }

  return (
    <>
      {/* 👇 NUEVO: TARJETITA ROJA ANIMADA DE INSUFICIENCIA DE STOCK */}
      <div 
        className={`transition-all duration-300 overflow-hidden ${
          stockError ? "max-h-24 opacity-100 mt-4 mb-2" : "max-h-0 opacity-0 m-0"
        }`}
      >
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center text-sm font-medium shadow-sm">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2 shrink-0" />
          <span>
            Cantidad insuficiente. El stock máximo disponible es de <strong className="font-bold text-red-800">{product.totalStock}</strong> unidades.
          </span>
        </div>
      </div>

      <div className={`flex flex-col sm:flex-row items-center gap-4 ${!stockError ? 'mt-6' : ''}`}>
        
        {/* CONTADOR DE CANTIDAD */}
        <div className="flex items-center justify-between border-2 border-slate-100 focus-within:border-blue-900 focus-within:ring-1 focus-within:ring-blue-900 transition-all duration-300 rounded-2xl bg-white p-1.5 w-full sm:w-auto sm:min-w-35 shadow-sm overflow-hidden">
          <button 
            onClick={handleDecrease} 
            disabled={(Number(quantity) || 1) <= 1}
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-900 hover:bg-blue-50 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer shrink-0"
          >
            <Minus className="w-5 h-5" />
          </button>
          
          <input 
            type="number"
            min="1"
            max={product.totalStock}
            value={quantity}
            onChange={handleInputChange}
            onBlur={handleBlur}
            className="font-bold text-slate-900 text-lg w-16 text-center focus:outline-none bg-transparent hide-arrows"
            style={{ MozAppearance: 'textfield' }} 
          />
          
          <button 
            onClick={handleIncrease} 
            disabled={(Number(quantity) || 1) >= product.totalStock}
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-900 hover:bg-blue-50 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* BOTÓN CORPORATIVO */}
        <button 
          onClick={handleAddToCart}
          className="flex-1 w-full bg-blue-900 text-white rounded-2xl py-4 px-6 font-bold flex justify-center items-center hover:bg-blue-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
          <ShoppingBag className="w-5 h-5 mr-3" /> 
          Añadir al Pedido
        </button>
        
      </div>

      <style jsx global>{`
        .hide-arrows::-webkit-outer-spin-button,
        .hide-arrows::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>

      {/* LA NOTIFICACIÓN ANIMADA DE "AÑADIDO" */}
      {isVisible && (
        <div 
          className={`fixed bottom-6 right-6 z-50 transform transition-all duration-500 ease-out ${
            isSlidIn 
              ? "translate-x-0 opacity-100"       
              : "translate-x-full opacity-0"      
          }`}
        >
          <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <div>
              <p className="font-bold text-sm">¡Añadido al pedido!</p>
              <p className="text-xs text-slate-300">
                {addedQty === 1 
                  ? `Se agregó 1 unidad de ${product.name}.` 
                  : `Se agregaron ${addedQty} unidades de ${product.name}.`
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}