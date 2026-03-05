"use client";

import { useState, useEffect } from "react";
import { DollarSign, ShoppingBag, Users, Calendar, Filter, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export default function StatisticsTab() {
  const [viewMode, setViewMode] = useState<"mensual" | "anual">("mensual");
  
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentYearStr = String(today.getFullYear());

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);

  // Estados Reales de la Base de Datos
  const [chartData, setChartData] = useState<any[]>([]);
  const [topProductos, setTopProductos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // El motor que trae los datos reales cuando cambias la fecha
  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        let url = `${process.env.NEXT_PUBLIC_API_URL}/analytics/dashboard`;
        
        if (viewMode === "mensual") {
          const [y, m] = selectedMonth.split('-');
          url += `?year=${y}&month=${m}`;
        } else {
          url += `?year=${selectedYear}`;
        }
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setChartData(data.chartData);
          setTopProductos(data.topProductos);
        }
      } catch (error) {
        console.error("Error al cargar analíticas", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [viewMode, selectedMonth, selectedYear]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      
      {/* CABECERA Y FILTROS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative overflow-hidden">
        {isLoading && <div className="absolute top-0 left-0 w-full h-1 bg-blue-100"><div className="h-full bg-blue-600 animate-pulse w-1/3 rounded-r-full"></div></div>}
        
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center">
            Rendimiento Financiero {isLoading && <Loader2 className="w-5 h-5 ml-3 animate-spin text-blue-600"/>}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Análisis detallado de ingresos, alquileres y tráfico web.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 w-full lg:w-auto">
          <div className="flex items-center text-slate-500 font-medium text-sm px-2"><Filter className="w-4 h-4 mr-2" /> Filtrar por:</div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full sm:w-auto">
            <button onClick={() => setViewMode("mensual")} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${viewMode === "mensual" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-700"}`}>Mes</button>
            <button onClick={() => setViewMode("anual")} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${viewMode === "anual" ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-slate-700"}`}>Año</button>
          </div>
          <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
          <div className="relative w-full sm:w-auto">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
            {viewMode === "mensual" ? (
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer w-full sm:w-auto shadow-sm" />
            ) : (
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer w-full sm:w-auto appearance-none shadow-sm">
                <option value="2024">Año 2024</option>
                <option value="2025">Año 2025</option>
                <option value="2026">Año 2026</option>
                <option value="2027">Año 2027</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative">
          {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 rounded-3xl flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>}
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><DollarSign className="w-5 h-5 mr-2 text-emerald-500" /> Historial de Recaudación</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `Gs. ${value / 1000000}M`} />
                <Tooltip formatter={(value: any) => [formatPYG(Number(value) || 0), "Ingresos"]} cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="ingresos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative">
          {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 rounded-3xl flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>}
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><Users className="w-5 h-5 mr-2 text-purple-500" /> Visitas vs Alquileres Cerrados</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Line yAxisId="left" type="monotone" dataKey="visitas" name="Visitas a la Web" stroke="#a855f7" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                <Line yAxisId="right" type="monotone" dataKey="pedidos" name="Alquileres Cerrados" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TABLA DE PRODUCTOS TOP */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
        {isLoading && <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>}
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 flex items-center">
            <ShoppingBag className="w-5 h-5 mr-2 text-blue-500" /> Top 4 Productos Más Rentables 
            <span className="text-slate-400 font-normal text-sm ml-2">(En el periodo seleccionado)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                <th className="p-4 font-medium px-6">Posición y Producto</th>
                <th className="p-4 font-medium text-center">Cant. Alquilada</th>
                <th className="p-4 font-medium text-right px-6">Ingresos Generados</th>
              </tr>
            </thead>
            <tbody>
              {topProductos.length === 0 && !isLoading ? (
                <tr><td colSpan={3} className="text-center py-8 text-slate-500">No hay datos de alquileres para este periodo.</td></tr>
              ) : (
                topProductos.map((producto, index) => (
                  <tr key={producto.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>#{index + 1}</div>
                        <span className="font-semibold text-slate-900">{producto.nombre}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center text-slate-600 font-medium">{producto.alquileres} unidades</td>
                    <td className="p-4 px-6 text-right font-bold text-emerald-600">{formatPYG(producto.ingresos)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}