import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'

  return {
    rules: {
      userAgent: '*', // Aplica para todos los buscadores (Google, Bing, Yahoo)
      allow: '/', // Permite ver toda la página pública
      disallow: ['/admin/', '/iniciar-sesion/'], // Bloquea el panel de control por seguridad
    },
    sitemap: `${baseUrl}/sitemap.xml`, // Le dice a Google dónde está el mapa que creamos en el Paso 1
  }
}