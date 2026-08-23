import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.ltrecepciones.com').replace(/\/$/, '')

  const routes: MetadataRoute.Sitemap = [
    '',
    '/catalogos',
    '/iniciar-sesion',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1.0 : 0.8,
  }))

  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  if (!apiUrl) {
    return routes
  }

  try {
    const res = await fetch(`${apiUrl}/products`, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) return routes

    const products = await res.json()

    const productRoutes = Array.isArray(products)
      ? products.map((product: any) => ({
          url: `${baseUrl}/catalogos/${product.id}`,
          lastModified: new Date(product.updatedAt || new Date()),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        }))
      : []

    return [...routes, ...productRoutes]
  } catch (error) {
    console.error('Sitemap error:', error)
    return routes
  }
}