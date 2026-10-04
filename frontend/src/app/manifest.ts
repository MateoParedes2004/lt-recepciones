import { MetadataRoute } from 'next'

// Nombre, colores e ícono cuando alguien agrega el sitio a la pantalla de
// inicio del celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LT Recepciones · Alquiler para eventos',
    short_name: 'LT Recepciones',
    description: 'Alquiler de sillas, mesas, vajilla y mantelería para eventos en Asunción.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#004080',
    lang: 'es-PY',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
