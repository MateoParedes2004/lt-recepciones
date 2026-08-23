import { Armchair, Sparkles } from "lucide-react";

export default function LoadingCatalogos() {
  return (
    <main className="min-h-screen bg-slate-50 pt-8 pb-24">
      
      {/* CABECERA SKELETON */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 md:mb-14">
        <div className="bg-slate-900 rounded-3xl p-8 md:p-10 shadow-xl h-62.5 md:h-75 relative overflow-hidden">
          {/* Efecto de brillo pasando (Shimmer) */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-linear-to-r from-transparent via-white/10 to-transparent"></div>
        </div>
      </div>

      {/* CATEGORÍAS SKELETON */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {[1, 2].map((i) => (
          <section key={i} className="mb-12 md:mb-16">
            
            {/* Título Categoría Skeleton */}
            <div className="mb-5 md:mb-6 pb-3 border-b border-slate-200">
              <div className="h-8 bg-slate-200 rounded-md w-48 mb-2 animate-pulse"></div>
              <div className="h-4 bg-slate-200 rounded-md w-full max-w-md animate-pulse"></div>
            </div>

            {/* Productos Skeleton */}
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="w-[60vw] sm:w-55 md:w-64 shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm h-80 flex flex-col overflow-hidden">
                  {/* Foto Skeleton */}
                  <div className="h-36 md:h-40 bg-slate-100 animate-pulse"></div>
                  
                  {/* Textos Skeleton */}
                  <div className="p-4 grow space-y-3">
                    <div className="h-5 bg-slate-200 rounded w-3/4 animate-pulse"></div>
                    <div className="h-3 bg-slate-200 rounded w-full animate-pulse"></div>
                    <div className="h-3 bg-slate-200 rounded w-5/6 animate-pulse"></div>
                  </div>
                  
                  {/* Botones Skeleton */}
                  <div className="p-4 border-t border-slate-50 flex justify-between items-center">
                    <div className="h-8 bg-slate-200 rounded w-16 animate-pulse"></div>
                    <div className="h-8 bg-slate-200 rounded-full w-24 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}