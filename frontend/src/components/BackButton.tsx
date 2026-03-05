"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.back()} 
      className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-blue-700 transition-colors mb-8 group cursor-pointer bg-transparent border-none p-0"
    >
      <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
      Volver al catálogo completo
    </button>
  );
}