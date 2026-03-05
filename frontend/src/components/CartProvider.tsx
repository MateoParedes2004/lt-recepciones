"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation"; 
import { ShoppingCart, X, Plus, Minus, Send, PackageOpen } from "lucide-react";
// 👇 IMPORTAMOS FRAMER MOTION PARA ANIMAR EL CARRITO
import { motion, AnimatePresence } from "framer-motion";

const CartContext = createContext<any>(null);

export const useCart = () => useContext(CartContext);

export default function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  const pathname = usePathname() || "";

  // 📞 TU NÚMERO DE WHATSAPP
  const WHATSAPP_NUMBER = "595985867749";

  useEffect(() => {
    setIsMounted(true);
    const savedCart = localStorage.getItem("lt_cart");
    if (savedCart) setCart(JSON.parse(savedCart));
  }, []);

  useEffect(() => {
    if (isMounted) localStorage.setItem("lt_cart", JSON.stringify(cart));
  }, [cart, isMounted]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const addToCart = (product: any, quantity: number = 1) => {
    setCart((prev) => {
      const exists = prev.find((item) => item.product.id === product.id);
      if (exists) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { product, quantity: quantity }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    setCart((prev) => prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item)));
  };

  const totalAmount = cart.reduce((acc, item) => acc + item.product.pricePerDay * item.quantity, 0);
  const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  const sendToWhatsApp = () => {
    let message = `¡Hola *LT Recepciones*! ✨\nMe gustaría solicitar un presupuesto para el siguiente equipamiento:\n\n*🛒 DETALLE DEL PEDIDO:*\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
    
    cart.forEach((item) => {
      const subtotal = item.product.pricePerDay * item.quantity;
      message += `▪ *${item.quantity}x ${item.product.name}*\n  ${formatPYG(item.product.pricePerDay)} c/u ➔ _Subtotal: ${formatPYG(subtotal)}_\n`;
    });
    
    message += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n*💰 TOTAL ESTIMADO: ${formatPYG(totalAmount)}*\n\n`;
    message += `📅 *Fecha del evento:* [ Indicar fecha ]\n📍 *Lugar/Zona:* [ Indicar zona ]\n\n¡Quedo a la espera de su respuesta para coordinar! 🥂`;
    
    const encodedMessage = encodeURIComponent(message);
    
    window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`, "_blank");
  };

  const showWhatsApp = !pathname.startsWith("/admin") && !pathname.startsWith("/iniciar-sesion");
  const showCartButton = pathname.startsWith("/catalogos");

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity }}>
      {children}

      {isMounted && (
        <>
          <div className="fixed bottom-6 right-6 flex flex-col gap-4 items-center z-40">
            
            {showWhatsApp && (
              <a
                href={`https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent("¡Hola LT Recepciones! ✨ Me gustaría hacerles una consulta sobre sus servicios.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#25D366] text-white p-3.5 rounded-full shadow-2xl hover:bg-[#20b858] transition-transform hover:scale-110 group cursor-pointer flex items-center justify-center"
                title="Chatea directamente con nosotros"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" className="w-9 h-9 drop-shadow-sm">
                  <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                </svg>
              </a>
            )}

            {showCartButton && (
              <button
                onClick={() => setIsOpen(true)}
                className="bg-blue-900 text-white p-4 rounded-full shadow-2xl hover:bg-blue-800 transition-transform hover:scale-110 group cursor-pointer"
                title="Ver mi cotización"
              >
                <div className="relative">
                  <ShoppingCart className="w-6 h-6" />
                  {/* 👇 ANIMACIÓN 1: El globito rojo aparece/desaparece con efecto de pop-up */}
                  <AnimatePresence>
                    {cart.length > 0 && (
                      <motion.span 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white"
                      >
                        {cart.reduce((acc, item) => acc + item.quantity, 0)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            )}
          </div>

          {showCartButton && (
            <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-2xl font-serif font-bold tracking-wide text-slate-900 flex items-center">
                  <ShoppingCart className="w-6 h-6 mr-3 text-blue-900" /> Cotización
                </h3>
                <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 bg-white rounded-full shadow-sm cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-white">
                {cart.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4"
                  >
                    <PackageOpen className="w-16 h-16 opacity-20" />
                    <p className="font-medium">Tu lista está vacía</p>
                  </motion.div>
                ) : (
                  <div className="flex flex-col">
                    {/* 👇 ANIMACIÓN 2: Los productos se deslizan suavemente al ser eliminados */}
                    <AnimatePresence initial={false}>
                      {cart.map((item) => (
                        <motion.div 
                          key={item.product.id} 
                          layout 
                          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                          animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                          exit={{ opacity: 0, height: 0, marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0, overflow: "hidden" }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="flex gap-4 border-b border-slate-50 pb-4"
                        >
                          <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                            {item.product.imageUrl ? (
                              <img src={item.product.imageUrl.startsWith("http") ? item.product.imageUrl : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}${item.product.imageUrl}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300"><ShoppingCart className="w-6 h-6"/></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 text-sm leading-tight mb-1">{item.product.name}</h4>
                            <p className="text-blue-900 font-bold text-sm mb-2">{formatPYG(item.product.pricePerDay)}</p>
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center border border-slate-200 rounded-lg">
                                <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="px-2 py-1 text-slate-500 hover:bg-slate-50 cursor-pointer"><Minus className="w-3 h-3" /></button>
                                <span className="px-2 text-sm font-bold text-slate-700 w-8 text-center">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="px-2 py-1 text-slate-500 hover:bg-slate-50 cursor-pointer"><Plus className="w-3 h-3" /></button>
                              </div>
                              <button onClick={() => removeFromCart(item.product.id)} className="text-xs text-red-500 hover:text-red-700 font-medium underline cursor-pointer">Quitar</button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 p-6 bg-slate-50">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-500 font-medium">Total Estimado</span>
                  {/* 👇 ANIMACIÓN 3: El Total hace un "pop" al cambiar de valor */}
                  <motion.span 
                    key={totalAmount}
                    initial={{ scale: 1.1, color: "#2563eb" }}
                    animate={{ scale: 1, color: "#0f172a" }}
                    className="text-2xl font-serif font-bold text-slate-900"
                  >
                    {formatPYG(totalAmount)}
                  </motion.span>
                </div>
                <button onClick={sendToWhatsApp} disabled={cart.length === 0} className="w-full py-3.5 bg-emerald-500 text-white font-bold tracking-wide rounded-xl hover:bg-emerald-600 transition-colors flex items-center justify-center shadow-lg disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer">
                  <Send className="w-5 h-5 mr-2" /> Enviar Pedido por WhatsApp
                </button>
              </div>
            </div>
          )}

          {isOpen && showCartButton && <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"></div>}
        </>
      )}
    </CartContext.Provider>
  );
}