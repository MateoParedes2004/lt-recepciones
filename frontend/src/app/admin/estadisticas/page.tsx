"use client";

import { useState } from "react";
import { DollarSign, ShoppingBag, Users, TrendingUp, Package, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

// --- DATOS SIMULADOS (Luego se conectarán a tu Backend) ---
const dataMensual = [
  { name: 'Semana 1', ingresos: 4500000, pedidos: 12, visitas: 320 },
  { name: 'Semana 2', ingresos: 5200000, pedidos: 15, visitas: 410 },
  { name: 'Semana 3', ingresos: 3800000, pedidos: 10, visitas: 290 },
  { name: 'Semana 4', ingresos: 7100000, pedidos: 22, visitas: 550 },
];

const dataAnual = [
  { name: 'Ene', ingresos: 12000000, pedidos: 45, visitas: 1200 },
  { name: 'Feb', ingresos: 15000000, pedidos: 52, visitas: 1500 },
  { name: 'Mar', ingresos: 18000000, pedidos: 61, visitas: 1800 },
  { name: 'Abr', ingresos: 14000000, pedidos: 48, visitas: 1400 },
  { name: 'May', ingresos: 22000000, pedidos: 75, visitas: 2100 },
  { name: 'Jun', ingresos: 25000000, pedidos: 82, visitas: 2400 },
];

const topProductos = [
  { id: 1, nombre: "Silla Tiffany Blanca", alquileres: 850, ingresos: 8500000 },
  { id: 2, nombre: "Mesa Imperial Vintage", alquileres: 120, ingresos: 6000000 },
  { id: 3, nombre: "Copa de Cristal Bohemia", alquileres: 1200, ingresos: 3600000 },
  { id: 4, nombre: "Plato de Sitio Dorado", alquileres: 900, ingresos: 2700000 },
];

const formatPYG = (amount: number) => `Gs. ${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

export default function EstadisticasPage() {
  const [periodo, setPeriodo] = useState<"mensual" | "anual">("anual");
  
  const datosActuales = periodo === "mensual" ? dataMensual : dataAnual;

  // Cálculos rápidos para las tarjetas superiores
  const totalIngresos = datosActuales.reduce((acc, curr) => acc + curr.ingresos, 0);
  const totalPedidos = datosActuales.reduce((acc, curr) => acc + curr.pedidos, 0);
  const totalVisitas = datosActuales.reduce((acc, curr) => acc + curr.visitas, 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Cabecera y Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rendimiento del Negocio</h1>
          <p className="text-slate-500 text-sm mt-1">Analiza tus métricas clave y el crecimiento de LT Recepciones.</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setPeriodo("mensual")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${periodo === "mensual" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700 cursor-pointer"}`}
          >
            Este Mes
          </button>
          <button 
            onClick={() => setPeriodo("anual")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${periodo === "anual" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700 cursor-pointer"}`}
          >
            Este Año
          </button>
        </div>
      </div>

      {/* 1. Tarjetas de KPIs (Indicadores Clave) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Ingresos Totales</p>
            <h3 className="text-xl font-bold text-slate-900">{formatPYG(totalIngresos)}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Pedidos Realizados</p>
            <h3 className="text-xl font-bold text-slate-900">{totalPedidos}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Visitas a la Web</p>
            <h3 className="text-xl font-bold text-slate-900">{totalVisitas}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Conversión aprox.</p>
            <h3 className="text-xl font-bold text-slate-900">{((totalPedidos / totalVisitas) * 100).toFixed(1)}%</h3>
          </div>
        </div>
      </div>

      {/* 2. Gráficos Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Gráfico de Ingresos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-emerald-500" /> Historial de Recaudación
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosActuales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} tickFormatter={(value) => `Gs. ${value / 1000000}M`} />
                <Tooltip formatter={(value: any) => [formatPYG(Number(value) || 0), "Ingresos"]} cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="ingresos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Visitas vs Pedidos */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <Users className="w-5 h-5 mr-2 text-purple-500" /> Visitas vs Pedidos
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datosActuales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                <Tooltip 
                  cursor={{stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Line yAxisId="left" type="monotone" dataKey="visitas" name="Visitas" stroke="#a855f7" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                <Line yAxisId="right" type="monotone" dataKey="pedidos" name="Pedidos" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. Tabla de Productos Más Alquilados */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-500" /> Productos Más Alquilados (Top 4)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                <th className="p-4 font-medium">Producto</th>
                <th className="p-4 font-medium text-center">Cant. Alquilada</th>
                <th className="p-4 font-medium text-right">Ingresos Generados</th>
              </tr>
            </thead>
            <tbody>
              {topProductos.map((producto, index) => (
                <tr key={producto.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>
                        #{index + 1}
                      </div>
                      <span className="font-semibold text-slate-900">{producto.nombre}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center text-slate-600 font-medium">
                    {producto.alquileres} un.
                  </td>
                  <td className="p-4 text-right font-bold text-emerald-600">
                    {formatPYG(producto.ingresos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}