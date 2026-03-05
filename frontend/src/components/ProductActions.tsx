"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBag, CheckCircle2 } from "lucide-react";
import { useCart } from "./CartProvider"; 

export default function ProductActions({ product }: { product: any }) {
  const [quantity, setQuantity] = useState(1);
  const [addedQty, setAddedQty] = useState(1);
  
  // Estados para la Animación Perfecta
  const [isVisible, setIsVisible] = useState(false); // Dibuja el cartel en el código
  const [isSlidIn, setIsSlidIn] = useState(false);   // Activa el deslizamiento visual
  
  const { addToCart } = useCart(); 

  const isOutOfStock = product.totalStock <= 0;

  const handleDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrease = () => {
    if (quantity < product.totalStock) setQuantity(quantity + 1);
  };

  const handleAddToCart = () => {
    // 1. Mandamos al carrito y guardamos el número para el texto
    addToCart(product, quantity);
    setAddedQty(quantity);

    // 2. Dibujamos el cartel (pero empieza invisible y corrido a la derecha)
    setIsVisible(true);
    setIsSlidIn(false);

    // 3. ¡EL TRUCO! Esperamos 50 milisegundos y disparamos la entrada suave
    setTimeout(() => {
      setIsSlidIn(true);
    }, 50);

    // 4. A los 2.5 segundos, activamos la salida suave hacia la derecha
    setTimeout(() => {
      setIsSlidIn(false);
    }, 2500);

    // 5. A los 3 segundos, lo borramos completamente del código
    setTimeout(() => {
      setIsVisible(false);
    }, 3000);
    
    // 6. Reiniciamos el contador de sillas a 1
    setQuantity(1);
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
      <div className="flex flex-col sm:flex-row items-center gap-4 mt-6">
        
        {/* CONTADOR DE CANTIDAD */}
        <div className="flex items-center justify-between border-2 border-slate-100 rounded-2xl bg-white p-1.5 w-full sm:w-auto sm:min-w-35 shadow-sm">
          <button 
            onClick={handleDecrease} 
            disabled={quantity <= 1}
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-900 hover:bg-blue-50 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
          >
            <Minus className="w-5 h-5" />
          </button>
          
          <span className="font-bold text-slate-900 text-lg w-10 text-center select-none">
            {quantity}
          </span>
          
          <button 
            onClick={handleIncrease} 
            disabled={quantity >= product.totalStock}
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-blue-900 hover:bg-blue-50 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
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

      {/* LA NOTIFICACIÓN ANIMADA (El Truco del Microsegundo aplicado) */}
      {isVisible && (
        <div 
          className={`fixed bottom-6 right-6 z-50 transform transition-all duration-500 ease-out ${
            isSlidIn 
              ? "translate-x-0 opacity-100"       // Posición final: visible en pantalla
              : "translate-x-full opacity-0"      // Posición inicial/final: oculto a la derecha
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