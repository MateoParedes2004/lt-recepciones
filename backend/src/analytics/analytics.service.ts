import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // 1. RUTA PARA REGISTRAR VISITAS
  async registrarVisita() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const visita = await this.prisma.siteVisit.upsert({
      where: { date: hoy },
      update: { count: { increment: 1 } },
      create: { date: hoy, count: 1 },
    });
    return { success: true, visita };
  }

  // 2. EL MOTOR DE ESTADÍSTICAS
  async getDashboardData(year: number, month?: number) {
    // Definimos desde y hasta qué fecha vamos a buscar en la Base de Datos
    let startDate: Date, endDate: Date;
    
    if (month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    } else {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    }

    // Traemos Visitas y Alquileres de ese periodo
    const visitas = await this.prisma.siteVisit.findMany({
      where: { date: { gte: startDate, lte: endDate } }
    });
    
    const alquileres = await this.prisma.rental.findMany({
      where: { eventDate: { gte: startDate, lte: endDate } },
      include: { items: { include: { product: true } } }
    });

    // --- CÁLCULO 1: TOP 4 PRODUCTOS ---
    const productStats: Record<number, any> = {};
    alquileres.forEach(rental => {
      rental.items.forEach(item => {
        if (!item.product) return; // Por si algún producto fue borrado
        
        if (!productStats[item.productId]) {
          productStats[item.productId] = { id: item.productId, nombre: item.product.name, alquileres: 0, ingresos: 0 };
        }
        productStats[item.productId].alquileres += item.quantity;
        productStats[item.productId].ingresos += (item.quantity * Number(item.product.pricePerDay));
      });
    });
    const topProductos = Object.values(productStats).sort((a: any, b: any) => b.alquileres - a.alquileres).slice(0, 4);

    // --- CÁLCULO 2: DATOS PARA LOS GRÁFICOS ---
    
    // 👇 ESTA ES LA LÍNEA MÁGICA QUE SOLUCIONA EL ERROR:
    let chartData: { name: string; ingresos: number; pedidos: number; visitas: number }[] = [];
    
    if (month) {
      // Si es vista mensual, dividimos el mes en 4 semanas
      const lastDay = endDate.getDate();
      const getWeek = (day: number) => {
        if (day <= 7) return 0;
        if (day <= 14) return 1;
        if (day <= 21) return 2;
        return 3;
      };
      
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      const mName = monthNames[month - 1];

      chartData = [
        { name: `01-07 ${mName}`, ingresos: 0, pedidos: 0, visitas: 0 },
        { name: `08-14 ${mName}`, ingresos: 0, pedidos: 0, visitas: 0 },
        { name: `15-21 ${mName}`, ingresos: 0, pedidos: 0, visitas: 0 },
        { name: `22-${lastDay} ${mName}`, ingresos: 0, pedidos: 0, visitas: 0 },
      ];

      visitas.forEach(v => { chartData[getWeek(v.date.getDate())].visitas += v.count; });
      alquileres.forEach(r => {
        const w = getWeek(r.eventDate.getDate());
        chartData[w].pedidos += 1;
        chartData[w].ingresos += Number(r.totalPrice);
      });

    } else {
      // Si es vista anual, dividimos en 12 meses
      const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      chartData = monthNames.map(m => ({ name: `${m} ${year}`, ingresos: 0, pedidos: 0, visitas: 0 }));

      visitas.forEach(v => { chartData[v.date.getMonth()].visitas += v.count; });
      alquileres.forEach(r => {
        const m = r.eventDate.getMonth();
        chartData[m].pedidos += 1;
        chartData[m].ingresos += Number(r.totalPrice);
      });
    }

    return { chartData, topProductos };
  }
}