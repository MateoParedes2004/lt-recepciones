// Pantalla de carga de la ficha de producto: mismo esqueleto que la página
// real (imagen a la izquierda, detalles a la derecha) para que al llegar el
// contenido no haya saltos de layout. Sin esto, en una conexión lenta el
// click en un producto parecía "no responder" hasta que cargaba todo.
export default function LoadingProducto() {
  return (
    <main className="min-h-screen bg-slate-50 py-12" aria-busy="true" aria-label="Cargando producto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-10 w-36 bg-slate-200 rounded-xl animate-pulse" />

        <div className="bg-white rounded-4xl shadow-xl border border-slate-100 overflow-hidden mt-6">
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-1/2 bg-slate-100 min-h-75 md:min-h-125 animate-pulse" />

            <div className="w-full md:w-1/2 p-8 md:p-12 space-y-6">
              <div className="h-10 md:h-14 bg-slate-200 rounded-lg w-4/5 animate-pulse" />
              <div className="h-9 bg-slate-200 rounded-lg w-2/5 animate-pulse" />

              <div className="space-y-3 pt-2">
                <div className="h-4 bg-slate-200 rounded w-full animate-pulse" />
                <div className="h-4 bg-slate-200 rounded w-11/12 animate-pulse" />
                <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
              </div>

              <div className="border-t border-slate-100 pt-8 space-y-6">
                <div className="h-5 bg-slate-200 rounded w-56 animate-pulse" />
                <div className="h-14 bg-slate-200 rounded-2xl w-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
