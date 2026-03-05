"use client";

import { useState } from "react";
import { Plus, Edit, Trash2, Search, X, Image as ImageIcon, Filter, ChevronDown } from "lucide-react";

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

const getImageUrl = (path: string) => { 
  if (!path) return ""; 
  if (path.startsWith("http")) return path; 
  return `${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, '')}${path}`; 
};

export default function ProductsTab({ products, categories, fetchData, isLoadingData }: { products: any[], categories: any[], fetchData: () => void, isLoadingData: boolean }) {
  const [searchProduct, setSearchProduct] = useState("");
  const [filterCategory, setFilterCategory] = useState(""); // 👈 NUEVO ESTADO PARA EL FILTRO
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [formData, setFormData] = useState({ name: "", description: "", price: "", categoryId: "", totalStock: "" });

  // 👇 LÓGICA DE FILTRADO DOBLE (Texto + Categoría)
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchProduct.toLowerCase());
    const matchesCategory = filterCategory === "" || p.categoryId.toString() === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const file = e.target.files?.[0]; 
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); } 
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name); formDataToSend.append("description", formData.description);
      formDataToSend.append("pricePerDay", formData.price); formDataToSend.append("categoryId", formData.categoryId);
      formDataToSend.append("totalStock", formData.totalStock);
      if (imageFile) formDataToSend.append("image", imageFile);

      const method = editingId ? "PUT" : "POST"; const endpoint = editingId ? `/products/${editingId}` : "/products";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, { method, body: formDataToSend });
      if (res.ok) { closeModal(); fetchData(); } else { const err = await res.json(); alert(`Error: ${err.message}`); }
    } catch (error) { alert("Error de conexión"); } finally { setIsSaving(false); }
  };

  const handleEditClick = (product: any) => {
    setEditingId(product.id); setFormData({ name: product.name, description: product.description, price: product.pricePerDay.toString(), categoryId: product.categoryId.toString(), totalStock: product.totalStock?.toString() || "0" });
    setImagePreview(product.imageUrl ? getImageUrl(product.imageUrl) : ""); setImageFile(null); setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este producto?")) return;
    try { const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products/${id}`, { method: "DELETE" }); if (res.ok) fetchData(); else alert("Error al eliminar"); } catch (error) { console.error(error); }
  };

  const closeModal = () => { setIsModalOpen(false); setEditingId(null); setImageFile(null); setImagePreview(""); setFormData({ name: "", description: "", price: "", categoryId: "", totalStock: "" }); };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative z-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* BARRA DE HERRAMIENTAS (Buscador + Filtro + Botón) */}
      <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row justify-between gap-4 items-center">
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* 1. Buscador de Texto */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar producto..." 
              value={searchProduct} 
              onChange={(e) => setSearchProduct(e.target.value)} 
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none w-full shadow-sm" 
            />
          </div>

          {/* 2. Filtro de Categoría (NUEVO) */}
          <div className="relative w-full sm:w-56">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="pl-10 pr-8 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 focus:outline-none w-full appearance-none bg-white text-slate-600 shadow-sm cursor-pointer"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* 3. Botón Nuevo */}
        <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-blue-900 text-white px-5 py-2.5 rounded-xl hover:bg-blue-800 font-medium cursor-pointer shadow-md w-full lg:w-auto justify-center">
          <Plus className="w-5 h-5 mr-2" /> Nuevo Producto
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-sm uppercase"><th className="px-6 py-4">Producto</th><th className="px-6 py-4">Categoría</th><th className="px-6 py-4">Stock Disponible</th><th className="px-6 py-4">Precio Unit.</th><th className="px-6 py-4 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoadingData ? <tr><td colSpan={5} className="text-center py-8 text-slate-500">Cargando...</td></tr> : 
             filteredProducts.length === 0 ? <tr><td colSpan={5} className="text-center py-16 text-slate-400 flex flex-col items-center justify-center w-full"><Filter className="w-8 h-8 mb-2 opacity-50"/>No se encontraron productos con estos filtros.</td></tr> : 
             filteredProducts.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4"><div className="flex items-center space-x-3"><div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0 border border-slate-200">{p.imageUrl ? <img src={getImageUrl(p.imageUrl)} className="w-full h-full object-contain mix-blend-multiply"/> : <ImageIcon className="w-5 h-5 m-auto text-slate-400 mt-2.5"/>}</div><p className="font-semibold text-slate-900">{p.name}</p></div></td>
                <td className="px-6 py-4"><span className="px-2.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-900 border border-blue-100 font-medium">{p.category?.name || 'N/A'}</span></td>
                <td className="px-6 py-4"><div className="flex flex-col"><span className="font-bold text-lg text-slate-900">{p.totalStock} <span className="text-xs font-normal text-slate-500">libres</span></span>{p.rentedCount > 0 && <span className="text-xs text-amber-600 font-medium">({p.rentedCount} en alquiler)</span>}</div></td>
                <td className="px-6 py-4 font-medium">{formatPYG(p.pricePerDay)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button onClick={() => handleEditClick(p)} className="p-2 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors" title="Editar"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteClick(p.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">{editingId ? "Editar Producto" : "Agregar Producto"}</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200 cursor-pointer"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="productForm" onSubmit={handleSaveProduct} className="space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label><input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Precio</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">Gs.</span><input type="number" required value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none" /></div></div>
                  <div><label className="block text-sm font-medium text-slate-700 mb-1">Stock Total</label><input type="number" required value={formData.totalStock} onChange={(e) => setFormData({...formData, totalStock: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl font-bold text-blue-900 outline-none" /></div>
                </div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label><select required value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-900 outline-none bg-white cursor-pointer"><option value="" disabled>Seleccionar...</option>{categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label><textarea required rows={2} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none resize-none" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Foto</label><input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-blue-50 file:text-blue-900 hover:file:bg-blue-100 cursor-pointer" />{imagePreview && <div className="mt-3 relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex justify-center items-center"><img src={imagePreview} className="max-h-full object-contain mix-blend-multiply" /></div>}</div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50/50"><button type="button" onClick={closeModal} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl cursor-pointer">Cancelar</button><button type="submit" form="productForm" disabled={isSaving} className="px-5 py-2.5 bg-blue-900 text-white font-medium rounded-xl hover:bg-blue-800 shadow-md disabled:bg-blue-400 cursor-pointer">{isSaving ? "Guardando..." : "Guardar Producto"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}