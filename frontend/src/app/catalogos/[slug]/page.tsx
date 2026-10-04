import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import ProductDetail, { fallbackDescription } from "../../../components/catalog/ProductDetail";
import CategoryLanding, { categoryMetaDescription } from "../../../components/catalog/CategoryLanding";
import { getCategories, getCategoryBySlug, getProduct } from "../../../lib/catalog";
import { getImageUrl } from "../../../lib/api";
import { baseOpenGraph, categoryPath, productPath } from "../../../lib/site";

export const revalidate = 60;

// No se arma ninguna ficha durante el build (el backend de Render puede
// estar dormido y quedarían vacías): cada una se genera en su primera visita
// y queda guardada en caché, renovándose cada 60 s como el resto del sitio.
export async function generateStaticParams() {
  return [];
}

// Una misma sección del sitio con dos tipos de página:
//   /catalogos/12-silla-tiffany → ficha de producto (empieza con el número)
//   /catalogos/sillas           → página del rubro
type Params = Promise<{ slug: string }>;

function productIdFrom(slug: string): number | null {
  const match = /^(\d+)(?:-|$)/.exec(slug);
  return match ? Number(match[1]) : null;
}

/**
 * Qué hay en esta dirección. Primero se busca un rubro con ese nombre (un
 * rubro como "2x1 Promociones" también empieza con números y no debe
 * confundirse con el producto 2); si no hay, se trata como ficha de producto.
 * Si el backend no responde, getCategories/getProduct lanzan un error: se
 * muestra la pantalla de error y, si la página ya estaba en caché, Next sigue
 * sirviendo la versión anterior en vez de guardar una rota.
 */
async function resolveSlug(slug: string) {
  const category = await getCategoryBySlug(slug);
  if (category) return { category, product: null };
  const productId = productIdFrom(slug);
  const product = productId !== null ? await getProduct(productId) : null;
  return { category: null, product };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { category, product } = await resolveSlug(slug);

  if (product) {
    const description = (product.description?.trim() || fallbackDescription(product)).slice(0, 160);
    const title = `Alquiler de ${product.name} en Asunción`;
    const path = productPath(product);
    return {
      title,
      description,
      alternates: { canonical: path },
      openGraph: {
        ...baseOpenGraph,
        title: `${title} | LT Recepciones`,
        description,
        url: path,
        ...(product.imageUrl ? { images: [{ url: getImageUrl(product.imageUrl), alt: product.name }] } : {}),
      },
    };
  }

  if (!category) return { title: "Página no encontrada" };

  const title = `Alquiler de ${category.name} para Eventos en Asunción`;
  const description = categoryMetaDescription(category).slice(0, 160);
  const path = categoryPath(category);
  const cover = (category.products ?? []).find((p) => p.imageUrl);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      ...baseOpenGraph,
      title: `${title} | LT Recepciones`,
      description,
      url: path,
      ...(cover?.imageUrl ? { images: [{ url: getImageUrl(cover.imageUrl), alt: `Alquiler de ${category.name}` }] } : {}),
    },
  };
}

export default async function CatalogSlugPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { category, product } = await resolveSlug(slug);

  if (category) return <CategoryLanding category={category} allCategories={await getCategories()} />;

  // Un producto que de verdad no existe (o fue dado de baja) responde 404 real:
  // así Google lo saca del índice.
  if (!product) notFound();

  // Direcciones viejas (/catalogos/12) o con el nombre desactualizado
  // redirigen para siempre (308) a la dirección correcta: Google pasa todo
  // lo ganado a la nueva y no quedan dos páginas iguales compitiendo.
  const canonical = productPath(product);
  if (`/catalogos/${slug}` !== canonical) permanentRedirect(canonical);

  const categories = await getCategories();
  const productCategory = categories.find((c) => c.id === product.categoryId) ?? null;
  return <ProductDetail product={product} category={productCategory} />;
}
