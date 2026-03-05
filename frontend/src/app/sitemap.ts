import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 1. URL base de tu tienda (cuando la subas a internet, cambiarás esto por tu dominio real)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'

  // 2. Rutas estáticas de tu página
  const routes = ['', '/catalogos', '/iniciar-sesion'].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1.0 : 0.8, // La página principal tiene máxima prioridad (1.0)
  }))

  try {
    // 3. Rutas dinámicas: Le pedimos al backend todos tus productos
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/products`)
    if (!res.ok) throw new Error('Error al cargar productos para el sitemap')
    
    const products = await res.json()
    
    // Creamos una ruta en el mapa por cada producto que tengas en la base de datos
    const productRoutes = products.map((product: any) => ({
      url: `${baseUrl}/catalogos/${product.id}`, // Asumiendo que tendrás una página por producto
        lastModified: new Date(product.updatedAt || new Date()).toISOString(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
    }))

     // Unimos las rutas fijas con las de tus productos
    return [...routes, ...productRoutes]
    } catch (error) {
    console.error('Sitemap error:', error)
    return routes
    }
}