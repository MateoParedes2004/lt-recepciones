import type { Metadata, Viewport } from "next";
import { Playfair_Display, Lato } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";
import CartProvider from "../components/CartProvider";
import Footer from "../components/Footer";
import AnalyticsTracker from "../components/AnalyticsTracker";
import JsonLd from "../components/JsonLd";
import { getCategoriesOrEmpty } from "../lib/catalog";
import { BUSINESS, DEFAULT_OG_IMAGE, SITE_URL, absoluteUrl, baseOpenGraph } from "../lib/site";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-lato",
  display: "swap",
});

const DEFAULT_TITLE = "Alquiler de Sillas, Mesas y Vajilla para Eventos en Asunción | LT Recepciones";
const DEFAULT_DESCRIPTION =
  "Alquiler de mobiliario, vajilla, cristalería y mantelería para casamientos, cumpleaños y eventos corporativos en Asunción y Gran Asunción. Cotizá online y confirmá por WhatsApp.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | LT Recepciones",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: BUSINESS.name,
  authors: [{ name: BUSINESS.name }],
  creator: BUSINESS.name,
  publisher: BUSINESS.name,
  category: "Alquiler para eventos",
  alternates: { canonical: "/" },
  openGraph: {
    ...baseOpenGraph,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Código de verificación de Google Search Console: se pega en la variable
  // NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION de Vercel (sin tocar código).
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } }
    : {}),
  formatDetection: { telephone: true, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#004080",
};

// Quién es el negocio, para Google (ficha de empresa local) y para las IA que
// resumen resultados. Va en todas las páginas; el @id permite que las demás
// páginas (productos, rubros) se refieran a este mismo negocio.
const businessJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "LocalBusiness",
      "@id": `${SITE_URL}/#negocio`,
      name: BUSINESS.name,
      description:
        "Alquiler de mobiliario, vajilla, cristalería y mantelería para eventos en Asunción y Gran Asunción, Paraguay.",
      url: SITE_URL,
      logo: absoluteUrl("/logo-512.png"),
      image: [absoluteUrl(DEFAULT_OG_IMAGE.url), absoluteUrl("/principal1.png"), absoluteUrl("/principal3.png")],
      telephone: BUSINESS.phone,
      priceRange: "$$",
      currenciesAccepted: "PYG",
      address: {
        "@type": "PostalAddress",
        addressLocality: BUSINESS.city,
        addressRegion: "Asunción",
        addressCountry: BUSINESS.country,
      },
      geo: { "@type": "GeoCoordinates", ...BUSINESS.geo },
      hasMap: `https://www.google.com/maps/search/?api=1&query=${BUSINESS.geo.latitude},${BUSINESS.geo.longitude}`,
      areaServed: [
        { "@type": "City", name: "Asunción" },
        { "@type": "AdministrativeArea", name: "Gran Asunción" },
        { "@type": "AdministrativeArea", name: "Central" },
      ],
      contactPoint: {
        "@type": "ContactPoint",
        telephone: BUSINESS.phone,
        contactType: "customer service",
        availableLanguage: ["es"],
      },
      sameAs: [BUSINESS.instagram, BUSINESS.facebook],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#sitio`,
      url: SITE_URL,
      name: BUSINESS.name,
      alternateName: ["LT Recepciones Paraguay", "LT Recepciones Asunción"],
      inLanguage: "es-PY",
      publisher: { "@id": `${SITE_URL}/#negocio` },
    },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Los rubros del menú se traen en el servidor: así llegan en el HTML (los
  // buscadores siguen esos enlaces y el menú ya no muestra "Cargando…").
  // Solo id y nombre: los productos de cada rubro no hacen falta en el menú y
  // viajarían en CADA página del sitio (todo el catálogo con descripciones).
  const categories = (await getCategoriesOrEmpty()).map(({ id, name }) => ({ id, name }));

  return (
    <html lang="es-PY" className="scroll-smooth" {...({ "data-scroll-behavior": "smooth" } as Record<string, string>)}>
      <body
        id="inicio"
        className={`${playfair.variable} ${lato.variable} antialiased flex flex-col min-h-screen scroll-pt-28`}
      >
        <CartProvider>
          <AnalyticsTracker />
          <Header initialCategories={categories} />
          <div className="grow">
            {children}
          </div>
          <Footer />
        </CartProvider>

        <JsonLd data={businessJsonLd} />
      </body>
    </html>
  );
}
