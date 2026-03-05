"use client";

import { useState, useRef } from "react";
import { Upload, Trash2, Eye, EyeOff, Loader2, Camera } from "lucide-react";

export default function GalleryTab({ gallery, fetchData, isLoadingData }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    
    // 👇 Agregamos TODAS las imágenes seleccionadas al formulario
    Array.from(files).forEach((file) => {
      formData.append("images", file);
    });
    
    if (uploadTitle) formData.append("title", uploadTitle);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/gallery`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadTitle("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchData(); // Recarga las fotos
        alert(`¡${files.length} imagen(es) subida(s) con éxito!`);
      } else {
        alert("Error al subir las imágenes");
      }
    } catch (error) {
      alert("Error de conexión al subir las imágenes");
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleVisibility = async (id: number) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/gallery/${id}/toggle`, {
        method: "PATCH",
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error("Error al cambiar visibilidad", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que quieres borrar esta foto definitivamente?")) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/gallery/${id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchData();
    } catch (error) {
      console.error("Error al borrar foto", error);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <Camera className="w-6 h-6 mr-3 text-blue-900" /> Galería Pública
          </h2>
          <p className="text-slate-500 mt-1">Selecciona varias fotos a la vez para subir eventos completos más rápido.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto bg-slate-50 p-2 rounded-2xl border border-slate-100">
          <input 
            type="text" 
            placeholder="Título (Ej: Boda María)" 
            className="px-4 py-2 rounded-xl border-none bg-white shadow-sm text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-48"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
          />
          <input 
            type="file" 
            accept="image/*" 
            multiple // 👈 MAGIA: Permite seleccionar múltiples archivos
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center px-4 py-2 bg-blue-900 text-white font-bold rounded-xl hover:bg-blue-800 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {isUploading ? "Subiendo..." : "Subir Fotos"}
          </button>
        </div>
      </div>

      {isLoadingData ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
      ) : gallery?.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Camera className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Tu galería está vacía</h3>
          <p className="text-slate-500">Haz clic en "Subir Fotos" y selecciona varias imágenes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {gallery.map((img: any) => (
            <div key={img.id} className={`group relative rounded-2xl overflow-hidden border ${img.isVisible ? 'border-slate-200 shadow-sm' : 'border-slate-300 opacity-60 grayscale-50'} h-48 bg-slate-100`}>
              <img src={img.imageUrl} alt={img.title || "Evento"} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
                <div className="flex justify-between items-start">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${img.isVisible ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>
                    {img.isVisible ? 'VISIBLE' : 'OCULTO'}
                  </span>
                  <button onClick={() => handleDelete(img.id)} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer" title="Borrar definitivamente">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <p className="text-white text-xs font-bold truncate mb-2">{img.title || "Sin título"}</p>
                  <button onClick={() => handleToggleVisibility(img.id)} className="w-full py-1.5 bg-white text-slate-900 text-xs font-bold rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100">
                    {img.isVisible ? <><EyeOff className="w-3 h-3 mr-1" /> Ocultar</> : <><Eye className="w-3 h-3 mr-1" /> Mostrar</>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}