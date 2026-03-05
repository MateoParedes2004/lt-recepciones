"use client";

import { useState } from "react";
import { Plus, Trash2, Search, X, CheckCircle, CalendarDays, PlusCircle } from "lucide-react";

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export default function RentalsTab({ rentals, products, fetchData, isLoadingData }: { rentals: any[], products: any[], fetchData: () => void, isLoadingData: boolean }) {
  const [searchRental, setSearchRental] = useState("");
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [isSavingRental, setIsSavingRental] = useState(false);
  const [rentalForm, setRentalForm] = useState({ clientName: "", clientPhone: "", eventDate: "", returnDate: "", items: [{ productId: "", quantity: 1 }] });

  const filteredRentals = rentals.filter(r => r.clientName.toLowerCase().includes(searchRental.toLowerCase()));

  const addRentalItem = () => { setRentalForm({ ...rentalForm, items: [...rentalForm.items, { productId: "", quantity: 1 }] }); };
  const removeRentalItem = (index: number) => { const newItems = rentalForm.items.filter((_, i) => i !== index); setRentalForm({ ...rentalForm, items: newItems }); };
  const updateRentalItem = (index: number, field: string, value: string | number) => { const newItems: any = [...rentalForm.items]; newItems[index][field] = value; setRentalForm({ ...rentalForm, items: newItems }); };

  const handleSaveRental = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingRental(true);
    try {
      const payload = {
        clientName: rentalForm.clientName, clientPhone: rentalForm.clientPhone,
        eventDate: new Date(rentalForm.eventDate).toISOString(), returnDate: new Date(rentalForm.returnDate).toISOString(),
        items: rentalForm.items.map(item => ({ productId: parseInt(item.productId), quantity: parseInt(item.quantity.toString()) }))
      };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rentals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { setIsRentalModalOpen(false); setRentalForm({ clientName: "", clientPhone: "", eventDate: "", returnDate: "", items: [{ productId: "", quantity: 1 }] }); fetchData(); } 
      else { const err = await res.json(); alert(`No se pudo crear: ${err.message}`); }
    } catch (error) { alert("Error de conexión"); } finally { setIsSavingRental(false); }
  };

  const handleMarkAsReturned = async (id: number) => {
    if (!window.confirm("¿Confirmas que el cliente devolvió todos los productos? Esto repondrá el stock físico.")) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/rentals/${id}/return`, { method: "PUT" });
      if (res.ok) fetchData(); else alert("Error al registrar devolución.");
    } catch (error) { console.error(error); }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Buscar cliente..." value={searchRental} onChange={(e) => setSearchRental(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none w-full sm:w-64" />
        </div>
        <button onClick={() => setIsRentalModalOpen(true)} className="flex items-center bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors font-medium shadow-md cursor-pointer">
          <Plus className="w-5 h-5 mr-2" /> Nuevo Alquiler
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">Cliente & Evento</th>
              <th className="px-6 py-4 font-medium">Productos Llevados</th>
              <th className="px-6 py-4 font-medium">Total</th>
              <th className="px-6 py-4 font-medium">Estado</th>
              <th className="px-6 py-4 font-medium text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingData ? <tr><td colSpan={5} className="text-center py-8 text-slate-500">Cargando...</td></tr> : 
             filteredRentals.length === 0 ? <tr><td colSpan={5} className="text-center py-12 text-slate-500"><CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3"/>No hay alquileres.</td></tr> : 
             filteredRentals.map((rental: any) => (
                <tr key={rental.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900 text-lg">{rental.clientName}</p>
                    <p className="text-sm text-slate-500 mb-1">{rental.clientPhone || 'Sin teléfono'}</p>
                    <div className="text-xs bg-slate-100 inline-block px-2 py-1 rounded text-slate-600">
                      <strong>Uso:</strong> {new Date(rental.eventDate).toLocaleDateString()} <br/>
                      <strong>Devolución:</strong> {new Date(rental.returnDate).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <ul className="text-sm text-slate-600 space-y-1">
                      {rental.items.map((item: any, i: number) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="font-bold text-blue-900 bg-blue-50 px-1.5 rounded">{item.quantity}x</span> 
                          <span className="truncate w-40 block">{item.product?.name || 'Producto borrado'}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{formatPYG(Number(rental.totalPrice))}</td>
                  <td className="px-6 py-4">
                    {rental.status === "ACTIVO" ? 
                      <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-200 animate-pulse">EN USO</span> : 
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold border border-slate-200">DEVUELTO</span>
                    }
                  </td>
                  <td className="px-6 py-4 text-right">
                    {rental.status === "ACTIVO" && (
                      <button onClick={() => handleMarkAsReturned(rental.id)} className="flex items-center justify-end w-full text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition-colors cursor-pointer">
                        <CheckCircle className="w-4 h-4 mr-1" /> Marcar Devuelto
                      </button>
                    )}
                  </td>
                </tr>
             ))
            }
          </tbody>
        </table>
      </div>

      {isRentalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h3 className="text-xl font-bold text-slate-900 flex items-center"><CalendarDays className="w-6 h-6 mr-2 text-emerald-600"/> Registrar Alquiler</h3>
              <button onClick={() => setIsRentalModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-full cursor-pointer"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="rentalForm" onSubmit={handleSaveRental} className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">1. Datos del Cliente y Fechas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label><input type="text" required value={rentalForm.clientName} onChange={(e) => setRentalForm({...rentalForm, clientName: e.target.value})} className="w-full px-4 py-2 border rounded-xl" placeholder="Ej. Juan Pérez" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label><input type="text" value={rentalForm.clientPhone} onChange={(e) => setRentalForm({...rentalForm, clientPhone: e.target.value})} className="w-full px-4 py-2 border rounded-xl" placeholder="09XX XXX XXX" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Fecha del Evento (Uso)</label><input type="date" required value={rentalForm.eventDate} onChange={(e) => setRentalForm({...rentalForm, eventDate: e.target.value})} className="w-full px-4 py-2 border rounded-xl" /></div>
                    <div><label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Devolución</label><input type="date" required value={rentalForm.returnDate} onChange={(e) => setRentalForm({...rentalForm, returnDate: e.target.value})} className="w-full px-4 py-2 border rounded-xl" /></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">2. Productos Solicitados</h4>
                    <button type="button" onClick={addRentalItem} className="text-sm font-bold text-blue-900 hover:text-blue-700 flex items-center bg-blue-50 px-3 py-1 rounded-lg cursor-pointer"><PlusCircle className="w-4 h-4 mr-1"/> Añadir Producto</button>
                  </div>
                  
                  <div className="space-y-3">
                    {rentalForm.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-sm">
                        <div className="flex-1">
                          <select required value={item.productId} onChange={(e) => updateRentalItem(index, 'productId', e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white text-sm">
                            <option value="" disabled>Seleccionar producto...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id} disabled={p.totalStock === 0}>
                                {p.name} - {formatPYG(p.pricePerDay)} (Stock: {p.totalStock})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <input type="number" required min="1" placeholder="Cant." value={item.quantity} onChange={(e) => updateRentalItem(index, 'quantity', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm text-center font-bold" />
                        </div>
                        {rentalForm.items.length > 1 && (
                          <button type="button" onClick={() => removeRentalItem(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 className="w-5 h-5"/></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50/80">
              <button type="button" onClick={() => setIsRentalModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl cursor-pointer">Cancelar</button>
              <button type="submit" form="rentalForm" disabled={isSavingRental} className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md flex items-center cursor-pointer">
                {isSavingRental ? "Procesando..." : "Confirmar y Descontar Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}