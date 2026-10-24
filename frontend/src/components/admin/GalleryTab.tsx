"use client";

import { useState, useRef } from "react";
import { Upload, Trash2, Eye, EyeOff, Loader2, Camera, Pencil, X, Check } from "lucide-react";
import { apiFetch, readApiError } from "../../lib/api";
import { GALLERY_EVENT_TYPES } from "../../lib/gallery";
import { useToast } from "./ToastProvider";
import type { GalleryImage } from "../../types";

const ALL = "Todas";
const UNCLASSIFIED = "Sin clasificar";

export default function GalleryTab({ gallery, fetchData, isLoadingData }: { gallery: GalleryImage[], fetchData: () => void, isLoadingData: boolean }) {
  const toast = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadEventType, setUploadEventType] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Qué foto se está editando (título/tipo) en este momento, para mostrarle
  // el formulario solo a esa tarjeta. null = ninguna.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // Filtro de la grilla: "todas", "sin clasificar" o un tipo de evento.
  const [filter, setFilter] = useState<string>(ALL);
  // Modo "Seleccionar": tocar una foto la marca para ponerle el tipo de
  // evento a varias de una vez (en vez de abrir el editor foto por foto).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkType, setBulkType] = useState<string>(GALLERY_EVENT_TYPES[0]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const unclassified = gallery.filter((g) => !g.eventType);
  const countOf = (f: string) => f === ALL ? gallery.length : f === UNCLASSIFIED ? unclassified.length : gallery.filter((g) => g.eventType === f).length;
  const shown = filter === ALL ? gallery : filter === UNCLASSIFIED ? unclassified : gallery.filter((g) => g.eventType === filter);
  // Si el filtro elegido se quedó sin fotos (ej. se clasificaron todas), se
  // vuelve a mostrar todo en vez de dejar una grilla vacía sin explicación.
  const effectiveFilter = filter !== ALL && shown.length === 0 ? ALL : filter;
  const visibleGallery = effectiveFilter === filter ? shown : gallery;

  // Solo cuentan las fotos marcadas que todavía existen (una puede haberse
  // borrado desde otra pestaña mientras estaba seleccionada).
  const selectedIds = [...selected].filter((id) => gallery.some((g) => g.id === id));

  const toggleSelected = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const handleBulkType = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkSaving(true);
    try {
      const results = await Promise.allSettled(selectedIds.map(async (id) => {
        const res = await apiFetch(`/gallery/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType: bulkType }),
        });
        if (!res.ok) throw new Error(await readApiError(res));
      }));
      const failed = results.filter((r) => r.status === "rejected").length;
      const done = results.length - failed;
      if (done > 0) fetchData();
      if (failed === 0) toast.success(`${done} foto${done === 1 ? "" : "s"} clasificada${done === 1 ? "" : "s"} como "${bulkType}".`);
      else toast.error(`${done} foto${done === 1 ? "" : "s"} clasificada${done === 1 ? "" : "s"}, pero ${failed} no se pudo guardar. Revisá e intentá de nuevo con esas.`);
      // Si falló alguna, queda seleccionada para reintentar solo esa.
      if (failed === 0) exitSelectMode();
      else setSelected(new Set(selectedIds.filter((_, i) => results[i].status === "rejected")));
    } finally {
      setIsBulkSaving(false);
    }
  };

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
    // El tipo de evento se aplica a todo el lote (todas las fotos que se
    // suben juntas suelen ser del mismo evento). Si se deja "Sin clasificar"
    // no se manda el campo, en vez de mandar un valor que el backend rechace.
    if (uploadEventType) formData.append("eventType", uploadEventType);

    try {
      const res = await apiFetch('/gallery', {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadTitle("");
        setUploadEventType("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchData(); // Recarga las fotos
        toast.success(files.length === 1 ? "Imagen subida con éxito." : `${files.length} imágenes subidas con éxito.`);
      } else {
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast.error(`No se pudieron subir las imágenes: ${await readApiError(res)}`);
      }
    } catch {
      toast.error("Error de conexión al subir las imágenes. Revisá tu internet e intentá de nuevo.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveEdit = async (id: number, title: string, eventType: string) => {
    setIsSavingEdit(true);
    try {
      const res = await apiFetch(`/gallery/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ...(eventType ? { eventType } : {}) }),
      });
      if (res.ok) { fetchData(); setEditingId(null); toast.success("Foto actualizada."); }
      else toast.error(`No se pudo guardar: ${await readApiError(res)}`);
    } catch {
      toast.error("Error de conexión. Revisá tu internet e intentá de nuevo.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleToggleVisibility = async (id: number) => {
    try {
      const res = await apiFetch(`/gallery/${id}/toggle`, {
        method: "PATCH",
      });
      if (res.ok) fetchData();
      else toast.error(`No se pudo cambiar la visibilidad: ${await readApiError(res)}`);
    } catch {
      toast.error("Error de conexión. Revisá tu internet e intentá de nuevo.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que quieres borrar esta foto definitivamente?")) return;
    try {
      const res = await apiFetch(`/gallery/${id}`, {
        method: "DELETE",
      });
      if (res.ok) { fetchData(); toast.success("Foto eliminada."); }
      else toast.error(`No se pudo borrar la foto: ${await readApiError(res)}`);
    } catch {
      toast.error("Error de conexión. Revisá tu internet e intentá de nuevo.");
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            <Camera className="w-6 h-6 mr-3 text-[#004080]" /> Galería Pública
          </h2>
          <p className="text-slate-500 mt-1">Selecciona varias fotos a la vez para subir eventos completos más rápido. El título y el tipo de evento se aplican a todas las fotos que subas juntas.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto bg-slate-50 p-2 rounded-2xl border border-slate-100">
          <input
            type="text"
            placeholder="Título (Ej: Boda María)"
            aria-label="Título de las fotos"
            className="px-4 py-2 rounded-xl border-none bg-white shadow-sm text-sm focus:ring-2 focus:ring-[#004080] outline-none w-full md:w-44 text-slate-900"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
          />
          <select
            aria-label="Tipo de evento de las fotos"
            className="px-4 py-2 rounded-xl border-none bg-white shadow-sm text-sm focus:ring-2 focus:ring-[#004080] outline-none w-full md:w-40 cursor-pointer text-slate-900"
            value={uploadEventType}
            onChange={(e) => setUploadEventType(e.target.value)}
          >
            <option value="">Sin clasificar</option>
            {GALLERY_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="file" 
            accept="image/jpeg,image/png,image/webp" 
            multiple // 👈 MAGIA: Permite seleccionar múltiples archivos
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center px-4 py-2 bg-[#004080] text-white font-bold rounded-xl hover:bg-[#00294f] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
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
          <p className="text-slate-500">Haz clic en &quot;Subir Fotos&quot; y selecciona varias imágenes.</p>
        </div>
      ) : (
        <>
        {unclassified.length > 0 && (
          <div role="status" className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl px-4 py-3">
            <p className="text-sm">
              <strong>{unclassified.length} foto{unclassified.length === 1 ? "" : "s"} sin clasificar.</strong> Las fotos sin tipo de evento no entran en las páginas de Bodas, Cumpleaños, etc., que ayudan a aparecer en Google. Marcá varias y asignales el tipo de una vez.
            </p>
            <button
              onClick={() => { setFilter(UNCLASSIFIED); setSelectMode(true); setSelected(new Set()); }}
              className="shrink-0 px-4 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 cursor-pointer"
            >
              Clasificarlas ahora
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {[ALL, ...(unclassified.length > 0 ? [UNCLASSIFIED] : []), ...GALLERY_EVENT_TYPES.filter((t) => countOf(t) > 0)].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={effectiveFilter === f}
              className={`h-9 px-4 rounded-full text-[13px] font-bold border transition-colors cursor-pointer ${effectiveFilter === f ? "bg-[#004080] text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:border-[#004080] hover:text-[#004080]"}`}
            >
              {f} <span className="opacity-70">{countOf(f)}</span>
            </button>
          ))}
          <button
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            aria-pressed={selectMode}
            className={`ml-auto h-9 px-4 rounded-full text-[13px] font-bold border cursor-pointer ${selectMode ? "bg-emerald-500 text-white border-transparent" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-500 hover:text-emerald-600"}`}
          >
            {selectMode ? "Salir de selección" : "Seleccionar varias"}
          </button>
        </div>

        {selectMode && (
          <div className="sticky top-2 z-30 mb-5 flex flex-wrap items-center gap-3 bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-lg">
            <span className="text-sm font-bold">{selectedIds.length} seleccionada{selectedIds.length === 1 ? "" : "s"}</span>
            <button onClick={() => setSelected(new Set(visibleGallery.map((g) => g.id)))} className="text-xs underline underline-offset-2 hover:text-[#3b9dff] cursor-pointer">Marcar las {visibleGallery.length} de esta vista</button>
            <button onClick={() => setSelected(new Set())} className="text-xs underline underline-offset-2 hover:text-[#3b9dff] cursor-pointer">Desmarcar</button>
            <div className="ml-auto flex items-center gap-2">
              <select
                aria-label="Tipo de evento para las fotos seleccionadas"
                value={bulkType}
                onChange={(e) => setBulkType(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-900 outline-none cursor-pointer"
              >
                {GALLERY_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                onClick={handleBulkType}
                disabled={selectedIds.length === 0 || isBulkSaving}
                className="px-4 py-1.5 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-600 cursor-pointer disabled:opacity-50 flex items-center"
              >
                {isBulkSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                Asignar tipo
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {visibleGallery.map((img) => (
            <GalleryCard
              key={img.id}
              img={img}
              selectMode={selectMode}
              isSelected={selected.has(img.id)}
              onToggleSelected={() => toggleSelected(img.id)}
              isEditing={editingId === img.id}
              isSaving={isSavingEdit}
              onEdit={() => setEditingId(img.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={(title, eventType) => handleSaveEdit(img.id, title, eventType)}
              onToggleVisibility={() => handleToggleVisibility(img.id)}
              onDelete={() => handleDelete(img.id)}
            />
          ))}
        </div>
        </>
      )}
    </div>
  );
}

// Una tarjeta de foto. Normalmente muestra el título/tipo con los botones
// de siempre (ocultar/borrar); en modo edición los reemplaza por un
// mini-formulario (título + tipo) con Guardar/Cancelar.
function GalleryCard({ img, selectMode, isSelected, onToggleSelected, isEditing, isSaving, onEdit, onCancelEdit, onSaveEdit, onToggleVisibility, onDelete }: {
  img: GalleryImage;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (title: string, eventType: string) => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const [draftTitle, setDraftTitle] = useState(img.title ?? "");
  const [draftEventType, setDraftEventType] = useState(img.eventType ?? "");

  const startEdit = () => {
    setDraftTitle(img.title ?? "");
    setDraftEventType(img.eventType ?? "");
    onEdit();
  };

  return (
    <div className={`group relative rounded-2xl overflow-hidden border ${img.isVisible ? 'border-slate-200 shadow-sm' : 'border-slate-300 opacity-60 grayscale-50'} h-48 bg-slate-100`}>
      <img src={img.imageUrl} alt={img.title || "Evento"} className="w-full h-full object-cover" />

      {/* Insignia del tipo de evento: siempre visible (no solo al pasar el
          mouse), para que el dueño vea de un vistazo qué fotos todavía están
          "sin clasificar" y hay que etiquetar. */}
      <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full ${img.eventType ? 'bg-[#004080] text-white' : 'bg-amber-500 text-white'}`}>
        {img.eventType || 'Sin clasificar'}
      </span>

      {selectMode ? (
        <button
          type="button"
          onClick={onToggleSelected}
          aria-pressed={isSelected}
          aria-label={`${isSelected ? "Quitar de la selección" : "Seleccionar"} ${img.title || "esta foto"}`}
          className={`absolute inset-0 cursor-pointer transition-colors ${isSelected ? "bg-[#004080]/30 ring-4 ring-inset ring-[#3b9dff]" : "hover:bg-slate-900/20"}`}
        >
          <span className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center border-2 ${isSelected ? "bg-[#3b9dff] border-white text-white" : "bg-white/80 border-slate-300 text-transparent"}`}>
            <Check className="w-4 h-4" />
          </span>
        </button>
      ) : isEditing ? (
        <div className="absolute inset-0 bg-slate-900/90 flex flex-col justify-center gap-2 p-3">
          <input
            type="text"
            placeholder="Título"
            aria-label="Título de la foto"
            autoFocus
            className="w-full px-2.5 py-1.5 rounded-lg border-none text-xs outline-none focus:ring-2 focus:ring-[#3b9dff] text-slate-900"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
          />
          <select
            aria-label="Tipo de evento de la foto"
            className="w-full px-2.5 py-1.5 rounded-lg border-none text-xs outline-none focus:ring-2 focus:ring-[#3b9dff] cursor-pointer text-slate-900"
            value={draftEventType}
            onChange={(e) => setDraftEventType(e.target.value)}
          >
            <option value="">Sin clasificar</option>
            {GALLERY_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => onSaveEdit(draftTitle, draftEventType)}
              disabled={isSaving}
              className="flex-1 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center justify-center cursor-pointer hover:bg-emerald-600 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" /> Guardar</>}
            </button>
            <button onClick={onCancelEdit} disabled={isSaving} className="flex-1 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-300 disabled:opacity-50">
              <X className="w-3 h-3 mr-1" /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
          <div className="flex justify-between items-start">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${img.isVisible ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}`}>
              {img.isVisible ? 'VISIBLE' : 'OCULTO'}
            </span>
            <div className="flex gap-1.5">
              <button onClick={startEdit} className="p-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer" title="Editar título y tipo" aria-label={`Editar ${img.title || "esta foto"}`}>
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={onDelete} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 cursor-pointer" title="Borrar definitivamente" aria-label={`Borrar definitivamente ${img.title || "esta foto"}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <p className="text-white text-xs font-bold truncate mb-2">{img.title || "Sin título"}</p>
            <button onClick={onToggleVisibility} className="w-full py-1.5 bg-white text-slate-900 text-xs font-bold rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100">
              {img.isVisible ? <><EyeOff className="w-3 h-3 mr-1" /> Ocultar</> : <><Eye className="w-3 h-3 mr-1" /> Mostrar</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}