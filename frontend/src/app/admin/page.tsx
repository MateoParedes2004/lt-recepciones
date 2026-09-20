"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Package, CalendarDays, TrendingUp, LogOut, Layers, Tags, BarChart3, Camera, MapPin, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import ProductsTab from "../../components/admin/ProductsTab";
import CategoriesTab from "../../components/admin/CategoriesTab";
import RentalsTab from "../../components/admin/RentalsTab";
import GalleryTab from "../../components/admin/GalleryTab";
import CitiesTab from "../../components/admin/CitiesTab";
import { apiFetch } from "../../lib/api";
import type { Product, Category, Rental, GalleryImage, City } from "../../types";

// StatisticsTab carga recharts (pesado): se difiere para que ese bundle solo
// se descargue si el admin realmente abre la pestaña de Estadísticas.
const StatisticsTab = dynamic(() => import("../../components/admin/StatisticsTab"), {
  loading: () => (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
    </div>
  ),
});

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("products");
  
  // Base de Datos Global
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  // Recursos que no se pudieron cargar (red caída, servidor caído, etc.):
  // sin esto, una falla se veía igual que "todavía no hay datos cargados".
  const [failedResources, setFailedResources] = useState<string[]>([]);

  const loadAll = async () => {
    const failed: string[] = [];
    const sources: { label: string; path: string; apply: (data: unknown) => void }[] = [
      { label: "productos", path: "/products", apply: (d) => setProducts(d as Product[]) },
      { label: "categorías", path: "/categories", apply: (d) => setCategories(d as Category[]) },
      { label: "alquileres", path: "/rentals", apply: (d) => setRentals(d as Rental[]) },
      { label: "galería", path: "/gallery/admin", apply: (d) => setGallery(d as GalleryImage[]) },
      { label: "ciudades", path: "/cities", apply: (d) => setCities(d as City[]) },
    ];
    // Cada recurso se carga por separado: si uno falla, los demás igual se
    // muestran (antes un solo error tiraba abajo la carga completa).
    await Promise.all(sources.map(async ({ label, path, apply }) => {
      try {
        const res = await apiFetch(path);
        if (res.ok) apply(await res.json());
        else failed.push(label);
      } catch {
        failed.push(label);
      }
    }));
    setFailedResources(failed);
    setIsLoadingData(false);
  };

  // Recarga los datos (lo usan las pestañas tras guardar, y el botón "Reintentar").
  const fetchData = () => {
    setIsLoadingData(true);
    return loadAll();
  };

  // La sesión ya la valida AdminAuthGate (el layout del panel) antes de montar
  // esta página: acá solo hay que hacer la carga inicial. isLoadingData ya
  // arranca en true, por eso no hace falta marcarlo de nuevo acá.
  useEffect(() => {
    // Carga de datos del servidor (sistema externo) al montar: los setState de
    // loadAll ocurren después de esperar las respuestas, no en el render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, []);

  const handleLogout = () => { localStorage.removeItem("admin_token"); router.push("/iniciar-sesion"); };

  // Cálculos Globales Rápidos para las tarjetas superiores
  const totalPhysicalUnits = products.reduce((acc, p) => acc + (p.totalStock || 0), 0);
  const activeRentalsCount = rentals.filter((r) => r.status === "ACTIVO").length;
  // Alquileres cuya fecha de evento cae en el mes actual (mismo criterio por
  // fecha de evento que usa la pestaña Estadísticas). eventDate es una fecha de
  // calendario pura (medianoche UTC), por eso se lee con getters UTC.
  const now = new Date();
  const currentMonthIncome = rentals.reduce((acc, r) => {
    const d = new Date(r.eventDate);
    const isThisMonth = d.getUTCFullYear() === now.getFullYear() && d.getUTCMonth() === now.getMonth();
    return isThisMonth ? acc + (Number(r.totalPrice) || 0) : acc;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 relative">
      
      {/* 1. CABECERA (Header) */}
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div><h1 className="text-3xl font-bold text-slate-900">Panel de Control</h1><p className="text-slate-500 mt-1">Gestión de inventario de LT Recepciones</p></div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3"><div className="relative w-10 h-10"><Image src="/logo.png" alt="LT Recepciones" fill sizes="40px" className="object-contain" /></div><span className="font-medium text-slate-700 hidden md:block">Administrador</span></div>
          <div className="h-8 w-px bg-slate-200"></div>
          <button onClick={handleLogout} className="flex items-center text-red-500 hover:text-red-700 font-medium transition-colors cursor-pointer"><LogOut className="w-5 h-5 mr-2" /> Salir</button>
        </div>
      </header>

      {/* 2. TARJETAS DE RESUMEN GLOBALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-4 bg-blue-50 text-[#004080] rounded-2xl"><Package className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-slate-500">Tipos de Producto</p><h3 className="text-2xl font-bold text-slate-900">{products.length}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Layers className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-slate-500">Stock Libre (Total)</p><h3 className="text-2xl font-bold text-slate-900">{totalPhysicalUnits}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl"><CalendarDays className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-slate-500">Alquileres Activos</p><h3 className="text-2xl font-bold text-slate-900">{activeRentalsCount}</h3></div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><TrendingUp className="w-6 h-6" /></div>
          <div><p className="text-sm font-medium text-slate-500">Ingresos del Mes</p><h3 className="text-2xl font-bold text-slate-900">{formatPYG(currentMonthIncome)}</h3></div>
        </div>
      </div>

      {/* AVISO DE CARGA FALLIDA (distingue "no se pudo cargar" de "no hay datos") */}
      {failedResources.length > 0 && !isLoadingData && (
        <div role="alert" className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-2xl">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <p className="flex-1 text-sm font-medium">
            No se pudieron cargar: {failedResources.join(", ")}. Lo que ves puede estar incompleto — no significa que no haya datos.
          </p>
          <button onClick={fetchData} className="inline-flex items-center justify-center gap-2 bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-700 cursor-pointer">
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      )}

      {/* 3. MENÚ DE PESTAÑAS */}
      <div className="inline-flex space-x-2 mb-6 bg-slate-200/50 p-1 rounded-2xl overflow-x-auto max-w-full">
        <button onClick={() => setActiveTab("products")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "products" ? "bg-white text-[#004080] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Package className="w-4 h-4 mr-2" /> Productos</button>
        <button onClick={() => setActiveTab("categories")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "categories" ? "bg-white text-[#004080] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Tags className="w-4 h-4 mr-2" /> Categorías</button>
        <button onClick={() => setActiveTab("rentals")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "rentals" ? "bg-white text-[#004080] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><CalendarDays className="w-4 h-4 mr-2" /> Alquileres</button>
        <button onClick={() => setActiveTab("gallery")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "gallery" ? "bg-white text-[#004080] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Camera className="w-4 h-4 mr-2" /> Galería</button>
        <button onClick={() => setActiveTab("statistics")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "statistics" ? "bg-white text-[#004080] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><BarChart3 className="w-4 h-4 mr-2" /> Estadísticas</button>
        {/*  NUEVO BOTÓN PARA CIUDADES */}
        <button onClick={() => setActiveTab("cities")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "cities" ? "bg-white text-[#004080] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><MapPin className="w-4 h-4 mr-2" /> Zonas de Entrega</button>
      </div>

      {/* 4. RENDERIZADO DINÁMICO DE PESTAÑAS */}
      {activeTab === "products" && <ProductsTab products={products} categories={categories} fetchData={fetchData} isLoadingData={isLoadingData} />}
      {activeTab === "categories" && <CategoriesTab categories={categories} fetchData={fetchData} />}
      {activeTab === "rentals" && <RentalsTab rentals={rentals} products={products} cities={cities} fetchData={fetchData} isLoadingData={isLoadingData} />}
      {activeTab === "gallery" && <GalleryTab gallery={gallery} fetchData={fetchData} isLoadingData={isLoadingData} />}
      {activeTab === "statistics" && <StatisticsTab />}
      {/* RENDERIZAMOS LA PESTAÑA DE CIUDADES */}
      {activeTab === "cities" && <CitiesTab cities={cities} fetchData={fetchData} isLoadingData={isLoadingData} />}

    </div>
  );
}