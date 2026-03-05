"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, CalendarDays, TrendingUp, LogOut, Layers, Tags, BarChart3, Camera } from "lucide-react";

// Importamos tus limpias "Piezas de Lego"
import ProductsTab from "../../components/admin/ProductsTab";
import CategoriesTab from "../../components/admin/CategoriesTab";
import RentalsTab from "../../components/admin/RentalsTab";
import StatisticsTab from "../../components/admin/StatisticsTab";
import GalleryTab from "../../components/admin/GalleryTab"; // 👈 NUEVO

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("products");
  
  // Base de Datos Global
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [rentals, setRentals] = useState<any[]>([]); 
  const [gallery, setGallery] = useState<any[]>([]); // 👈 ESTADO PARA LA GALERÍA

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) router.push("/iniciar-sesion");
    else { setIsLoading(false); fetchData(); }
  }, [router]);

  const fetchData = async () => {
    setIsLoadingData(true);
    try {
      const [prodRes, catRes, rentRes, galRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/products`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/rentals`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/gallery?admin=true`) // 👈 CARGAMOS LA GALERÍA
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (rentRes.ok) setRentals(await rentRes.json());
      if (galRes.ok) setGallery(await galRes.json());
    } catch (error) { console.error("Error cargando datos", error); } 
    finally { setIsLoadingData(false); }
  };

  const handleLogout = () => { localStorage.removeItem("admin_token"); router.push("/iniciar-sesion"); };

  // Cálculos Globales Rápidos para las tarjetas superiores
  const totalPhysicalUnits = products.reduce((acc, p: any) => acc + (p.totalStock || 0), 0);
  const activeRentalsCount = rentals.filter((r: any) => r.status === "ACTIVO").length;
  const currentMonthIncome = rentals.reduce((acc, r: any) => acc + (Number(r.totalPrice) || 0), 0);

  if (isLoading) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 relative">
      
      {/* 1. CABECERA (Header) */}
      <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div><h1 className="text-3xl font-bold text-slate-900">Panel de Control</h1><p className="text-slate-500 mt-1">Gestión de inventario de LT Recepciones</p></div>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3"><div className="w-10 h-10 bg-blue-900 rounded-full flex items-center justify-center font-bold text-white shadow-md">LT</div><span className="font-medium text-slate-700 hidden md:block">Administrador</span></div>
          <div className="h-8 w-px bg-slate-200"></div>
          <button onClick={handleLogout} className="flex items-center text-red-500 hover:text-red-700 font-medium transition-colors cursor-pointer"><LogOut className="w-5 h-5 mr-2" /> Salir</button>
        </div>
      </header>

      {/* 2. TARJETAS DE RESUMEN GLOBALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
          <div className="p-4 bg-blue-50 text-blue-900 rounded-2xl"><Package className="w-6 h-6" /></div>
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
          <div><p className="text-sm font-medium text-slate-500">Ingresos Proyectados</p><h3 className="text-2xl font-bold text-slate-900">{formatPYG(currentMonthIncome)}</h3></div>
        </div>
      </div>

      {/* 3. MENÚ DE PESTAÑAS */}
      <div className="inline-flex space-x-2 mb-6 bg-slate-200/50 p-1 rounded-2xl overflow-x-auto max-w-full">
        <button onClick={() => setActiveTab("products")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "products" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Package className="w-4 h-4 mr-2" /> Productos</button>
        <button onClick={() => setActiveTab("categories")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "categories" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Tags className="w-4 h-4 mr-2" /> Categorías</button>
        <button onClick={() => setActiveTab("rentals")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "rentals" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><CalendarDays className="w-4 h-4 mr-2" /> Alquileres</button>
        <button onClick={() => setActiveTab("gallery")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "gallery" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Camera className="w-4 h-4 mr-2" /> Galería</button>
        <button onClick={() => setActiveTab("statistics")} className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-300 cursor-pointer flex items-center whitespace-nowrap ${activeTab === "statistics" ? "bg-white text-blue-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><BarChart3 className="w-4 h-4 mr-2" /> Estadísticas</button>
      </div>

      {/* 4. RENDERIZADO DINÁMICO DE PESTAÑAS (La magia de los componentes) */}
      {activeTab === "products" && <ProductsTab products={products} categories={categories} fetchData={fetchData} isLoadingData={isLoadingData} />}
      {activeTab === "categories" && <CategoriesTab categories={categories} fetchData={fetchData} />}
      {activeTab === "rentals" && <RentalsTab rentals={rentals} products={products} fetchData={fetchData} isLoadingData={isLoadingData} />}
      {activeTab === "gallery" && <GalleryTab gallery={gallery} fetchData={fetchData} isLoadingData={isLoadingData} />}
      {activeTab === "statistics" && <StatisticsTab />}

    </div>
  );
}