// Pantalla de carga de /catalogos: misma forma que la página real (título y
// buscador, barra de rubros, secciones con tarjetas) para que al llegar el
// contenido no haya saltos. Antes dibujaba el banner oscuro del diseño viejo,
// que ya no existe: se veía un bloque negro y después cambiaba todo.
export default function LoadingCatalogos() {
  return (
    <main className="min-h-screen bg-slate-50 pt-8 pb-24" aria-busy="true" aria-label="Cargando catálogo">

      {/* CABECERA: título + buscador */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-5">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 md:h-11 w-56 md:w-72 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-72 md:w-md max-w-full bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-12 w-full md:w-110 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        </div>
      </div>

      {/* BARRA DE RUBROS */}
      <div className="bg-white/92 border-y border-slate-200 shadow-sm mb-8 md:mb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex gap-2 overflow-hidden">
          {[64, 140, 150, 170, 120, 70, 90].map((w, i) => (
            <div key={i} className="h-9 shrink-0 rounded-full bg-slate-100 animate-pulse" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* SECCIONES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {[1, 2].map((i) => (
          <section key={i} className="mb-12 md:mb-16">
            <div className="mb-5 md:mb-6 pb-3 border-b border-slate-200">
              <div className="h-8 bg-slate-200 rounded-md w-48 mb-2 animate-pulse"></div>
              <div className="h-4 bg-slate-200 rounded-md w-full max-w-md animate-pulse"></div>
            </div>

            <div className="flex gap-4 overflow-hidden md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="w-[60vw] sm:w-55 md:w-auto shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm h-72 flex flex-col overflow-hidden">
                  <div className="h-36 md:h-40 bg-slate-100 animate-pulse"></div>
                  <div className="p-4 grow space-y-3">
                    <div className="h-5 bg-slate-200 rounded w-3/4 animate-pulse"></div>
                    <div className="h-3 bg-slate-200 rounded w-full animate-pulse"></div>
                  </div>
                  <div className="p-4 border-t border-slate-50 flex justify-between items-center">
                    <div className="h-8 bg-slate-200 rounded w-16 animate-pulse"></div>
                    <div className="h-8 bg-slate-200 rounded-lg w-24 animate-pulse"></div>
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
