import { MetadataRoute } from 'next'
import { SITE_URL } from '../lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*', // Aplica para todos los buscadores (Google, Bing, Yahoo)
      allow: '/', // Permite ver toda la página pública
      // Sin barra final: "/admin/" no bloqueaba la dirección "/admin" en sí.
      disallow: ['/admin', '/iniciar-sesion'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
