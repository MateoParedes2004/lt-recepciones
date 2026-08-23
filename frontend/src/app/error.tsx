"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowRight } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error no controlado:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-6 py-24">
      <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h1 className="text-3xl md:text-5xl font-serif font-bold text-slate-900 mb-4 tracking-tight">
        Algo salió mal
      </h1>
      <p className="text-slate-500 text-base md:text-lg max-w-md mb-10">
        Ocurrió un error inesperado. Podés intentar de nuevo o volver al inicio.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => reset()}
          className="flex items-center justify-center px-8 py-4 text-sm sm:text-base font-bold text-white bg-blue-900 rounded-xl hover:bg-blue-800 transition-colors shadow-lg cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Intentar de nuevo
        </button>
        <Link
          href="/"
          className="flex items-center justify-center px-8 py-4 text-sm sm:text-base font-bold text-blue-900 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group"
        >
          Volver al inicio <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </main>
  );
}
