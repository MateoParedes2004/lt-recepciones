"use client";

import { useState } from "react";
import { Plus, Edit, Trash2, Search, X } from "lucide-react";
import { apiFetch, readApiError } from "../../lib/api";
import { useToast } from "./ToastProvider";
import type { Category } from "../../types";

export default function CategoriesTab({ categories, fetchData }: { categories: Category[], fetchData: () => void }) {
  const toast = useToast();
  const [searchCategory, setSearchCategory] = useState("");
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isSavingCat, setIsSavingCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [catFormData, setCatFormData] = useState({ name: "", description: "" });

  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(searchCategory.toLowerCase()));

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSavingCat(true);
    try {
      const method = editingCatId ? "PUT" : "POST";
      const endpoint = editingCatId ? `/categories/${editingCatId}` : "/categories";
      const res = await apiFetch(endpoint, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(catFormData)
      });
      if (res.ok) { closeCatModal(); fetchData(); toast.success(editingCatId ? "Categoría actualizada." : "Categoría creada."); }
      else toast.error(`No se pudo guardar la categoría: ${await readApiError(res)}`);
    } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); } finally { setIsSavingCat(false); }
  };

  const handleEditCatClick = (category: Category) => { setEditingCatId(category.id); setCatFormData({ name: category.name, description: category.description || "" }); setIsCatModalOpen(true); };
  
  const handleDeleteCatClick = async (id: number) => {
    if (!window.confirm("¿Eliminar esta categoría? Asegúrate de que no tenga productos asignados.")) return;
    try {
      const res = await apiFetch(`/categories/${id}`, { method: "DELETE" });
      if (res.ok) { fetchData(); toast.success("Categoría eliminada."); }
      else toast.error(await readApiError(res, "No se pudo eliminar la categoría."));
    } catch { toast.error("Error de conexión. Revisá tu internet e intentá de nuevo."); }
  };

  const closeCatModal = () => { setIsCatModalOpen(false); setEditingCatId(null); setCatFormData({ name: "", description: "" }); };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Buscar categoría..." value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)} className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none w-full sm:w-64" />
        </div>
        <button onClick={() => setIsCatModalOpen(true)} className="flex items-center bg-blue-900 text-white px-5 py-2.5 rounded-xl hover:bg-blue-800 font-medium cursor-pointer"><Plus className="w-5 h-5 mr-2" /> Nueva Categoría</button>
      </div>
      <table className="w-full text-left">
        <thead className="bg-slate-50 text-slate-500 text-sm uppercase"><tr><th className="px-6 py-4">Nombre</th><th className="px-6 py-4 text-right">Acciones</th></tr></thead>
        <tbody>
          {filteredCategories.length === 0 ? <tr><td colSpan={2} className="text-center py-8 text-slate-500">No se encontraron categorías.</td></tr> :
            filteredCategories.map((c)=>(
            <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 font-semibold text-slate-900">{c.name}</td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end space-x-2">
                  <button onClick={() => handleEditCatClick(c)} title="Editar" aria-label={`Editar categoría ${c.name}`} className="p-2 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg cursor-pointer"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteCatClick(c.id)} title="Eliminar" aria-label={`Eliminar categoría ${c.name}`} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h3 className="text-xl font-bold text-slate-900">{editingCatId ? "Editar Categoría" : "Nueva Categoría"}</h3><button onClick={closeCatModal} aria-label="Cerrar" className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200 cursor-pointer"><X className="w-6 h-6" /></button></div>
            <div className="p-6">
              <form id="catForm" onSubmit={handleSaveCategory} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label><input type="text" required value={catFormData.name} onChange={(e) => setCatFormData({...catFormData, name: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Descripción (Opcional)</label><textarea rows={3} value={catFormData.description} onChange={(e) => setCatFormData({...catFormData, description: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none resize-none" /></div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50/50"><button type="button" onClick={closeCatModal} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl cursor-pointer">Cancelar</button><button type="submit" form="catForm" disabled={isSavingCat} className="px-5 py-2.5 bg-blue-900 text-white font-medium rounded-xl hover:bg-blue-800 shadow-md disabled:bg-blue-400 cursor-pointer">{isSavingCat ? "Guardando..." : "Guardar Categoría"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}