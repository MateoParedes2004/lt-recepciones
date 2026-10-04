"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ fallbackHref = "/catalogos" }: { fallbackHref?: string }) {
  const router = useRouter();

  // Si la persona venía navegando el sitio, "volver" la lleva a donde estaba.
  // Si entró directo (desde Google, un link de WhatsApp o Instagram), el
  // "atrás" del navegador la sacaba del sitio: en ese caso va al catálogo.
  const handleClick = () => {
    let cameFromThisSite = false;
    try {
      cameFromThisSite = !!document.referrer && new URL(document.referrer).origin === window.location.origin;
    } catch {
      cameFromThisSite = false;
    }
    if (cameFromThisSite && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-700 transition-colors mb-8 group cursor-pointer bg-transparent border-none p-0"
    >
      <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
      Volver al catálogo completo
    </button>
  );
}
