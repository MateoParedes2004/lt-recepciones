"use client";

import { useEffect } from "react";

export default function AnalyticsTracker() {
  useEffect(() => {
    const registrarVisita = async () => {
      try {
        // 1. Obtenemos la fecha de hoy en formato local (Ej: "2026-02-16")
        const hoy = new Date().toLocaleDateString('es-PY');
        
        // 2. Buscamos en la memoria del celular/PC si ya visitó la página hoy
        const ultimaVisita = localStorage.getItem("lt_ultima_visita");

        // 3. Si no hay registro, o si la fecha es distinta (es un nuevo día)
        if (ultimaVisita !== hoy) {
          
          // Enviamos la alerta silenciosa a tu Base de Datos
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analytics/visita`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });

          // Si el servidor guardó la visita con éxito, le ponemos la "marca" al visitante
          if (res.ok) {
            localStorage.setItem("lt_ultima_visita", hoy);
            console.log("Nueva visita única registrada."); // Puedes borrar esto luego
          }
        }
      } catch (error) {
        // El rastreador es silencioso, si falla no rompe la página del cliente
        console.error("No se pudo registrar la visita:", error);
      }
    };

    // Le damos un pequeño retraso de 2 segundos para no hacer lenta la carga inicial de la página
    const timer = setTimeout(() => {
      registrarVisita();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Este componente es invisible, no muestra nada en pantalla
  return null; 
}