import { MetadataRoute } from 'next'
import { getCategories } from '../lib/catalog'
import { absoluteUrl, categoryPath, productPath } from '../lib/site'
import { getImageUrl } from '../lib/api'

// Se regenera como mucho una vez por hora con lo que haya en el catálogo.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const categories = await getCategories()
  const products = categories.flatMap((c) => c.products ?? [])

  // La fecha de la última modificación real del catálogo (no "ahora": si
  // cambia en cada visita, Google deja de creerle a este dato).
  const lastCatalogChange = products.reduce<Date | undefined>((latest, p) => {
    if (!p.updatedAt) return latest
    const d = new Date(p.updatedAt)
    return !latest || d > latest ? d : latest
  }, undefined)

  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: lastCatalogChange, changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/catalogos'), lastModified: lastCatalogChange, changeFrequency: 'weekly', priority: 0.9 },
  ]

  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((c) => (c.products ?? []).length > 0)
    .map((c) => {
      const latest = (c.products ?? []).reduce<Date | undefined>((acc, p) => {
        const d = p.updatedAt ? new Date(p.updatedAt) : undefined
        return d && (!acc || d > acc) ? d : acc
      }, undefined)
      return { url: absoluteUrl(categoryPath(c)), lastModified: latest, changeFrequency: 'weekly' as const, priority: 0.8 }
    })

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: absoluteUrl(productPath(p)),
    lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
    // Las fotos de producto también aparecen en Google Imágenes.
    ...(p.imageUrl ? { images: [getImageUrl(p.imageUrl)] } : {}),
  }))

  return [...pages, ...categoryPages, ...productPages]
}
