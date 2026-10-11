"use client";

import { Clock3, PackageCheck, PackageX, MapPin, CalendarDays } from "lucide-react";
import type { CheckoutIntent } from "../../types";

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
// Fecha de calendario pura (medianoche UTC), mismo criterio que el resto del panel.
const formatFecha = (iso: string) => new Date(iso).toLocaleDateString("es-PY", { timeZone: "UTC" });

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

/**
 * Pedidos que llegaron por WhatsApp (el cliente armó el carrito y apretó
 * "Enviar pedido") y todavía nadie revisó: el admin decide, tras hablar con
 * el cliente, si lo convierte en un alquiler real (precargado con estos
 * datos) o lo descarta porque no prosperó.
 */
export default function PendingOrdersPanel({
  intents,
  onConvert,
  onDiscard,
}: {
  intents: CheckoutIntent[];
  onConvert: (intent: CheckoutIntent) => void;
  onDiscard: (intent: CheckoutIntent) => void;
}) {
  if (intents.length === 0) return null;

  return (
    <div role="alert" className="mx-6 mt-5 bg-[#e8f0f8] border border-[#004080]/20 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 flex items-center gap-2 border-b border-[#004080]/15">
        <PackageCheck className="w-5 h-5 text-[#004080] shrink-0" />
        <p className="text-sm font-bold text-[#004080]">
          {intents.length === 1 ? "Hay 1 pedido nuevo por WhatsApp" : `Hay ${intents.length} pedidos nuevos por WhatsApp`} sin confirmar
        </p>
      </div>
      <div className="divide-y divide-[#004080]/10">
        {intents.map((intent) => (
          <div key={intent.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                <Clock3 className="w-3.5 h-3.5" /> {relativeTime(intent.createdAt)}
              </p>
              <p className="text-sm text-slate-800">
                {intent.items.length > 0 ? intent.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ") : "Sin productos detallados"}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                {intent.eventDate && intent.returnDate && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" /> {formatFecha(intent.eventDate)} a {formatFecha(intent.returnDate)}
                  </span>
                )}
                {intent.cityName && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {intent.cityName}
                  </span>
                )}
                <span className="font-bold text-[#004080]">{formatPYG(intent.totalAmount)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onDiscard(intent)}
                title="Descartar: no prosperó"
                aria-label="Descartar pedido"
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
              >
                <PackageX className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onConvert(intent)}
                className="flex items-center gap-1.5 bg-[#004080] text-white text-sm font-bold px-3 py-2 rounded-lg hover:bg-[#00294f] cursor-pointer whitespace-nowrap transition-colors"
              >
                Convertir en alquiler
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
