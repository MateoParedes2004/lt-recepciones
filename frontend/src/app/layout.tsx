import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, Lato } from "next/font/google";
import "./globals.css";
import Header from "../components/Header"; 
import CartProvider from "../components/CartProvider"; 
import Footer from "../components/Footer";
import AnalyticsTracker from "../components/AnalyticsTracker"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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

// 🚀 METADATA GLOBAL ULTRA OPTIMIZADA
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: "LT Recepciones | Servicios de Alquileres para Eventos",
    template: "%s | LT Recepciones", // Magia pura: ahora las subpáginas dirán "Catálogo | LT Recepciones"
  },
  description: "Especialistas en alquiler de mobiliario, vajilla y cristalería en Asunción, Paraguay. Transformamos tus espacios en momentos inolvidables.",
  keywords: [
    "alquiler de sillas asuncion", 
    "alquiler de mesas asuncion", 
    "vajilla para eventos", 
    "eventos paraguay", 
    "sillas tiffany", 
    "servicios para eventos", 
    "servicios para fiestas", 
    "fiestas", 
    "manteles", 
    "LT recepciones",
    "alquiler de living para eventos"
  ],
  authors: [{ name: "LT Recepciones" }],
  creator: "LT Recepciones",
  openGraph: {
    title: "LT Recepciones | Equipamiento Premium",
    description: "Alquiler de mobiliario y vajilla de la más alta calidad para tu evento en Asunción.",
    url: "https://www.ltrecepciones.com",
    siteName: "LT Recepciones",
    images: [{ url: "/principal1.png", width: 1200, height: 630, alt: "Montaje de evento premium por LT Recepciones" }],
    locale: "es_PY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LT Recepciones | Alquiler para Eventos",
    description: "Mobiliario premium para tu evento en Asunción.",
    images: ["/principal1.png"],
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
  icons: {
    icon: '/logo.png', 
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  // 🚀 MICRODATOS ENRIQUECIDOS PARA GOOGLE LOCAL
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EventEquipmentRental",
    "name": "LT Recepciones",
    "image": "https://www.ltrecepciones.com/principal1.png",
    "description": "Especialistas en alquiler de equipamiento premium para eventos en Asunción.",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Asunción",
      "addressCountry": "PY"
    },
    "telephone": "+595985867749",
    "url": "https://www.ltrecepciones.com",
    "priceRange": "$$",
    "areaServed": "Asunción y Gran Asunción"
  };

  return (
    <html lang="es" className="scroll-smooth" {...{ "data-scroll-behavior": "smooth" } as any}>
      <body 
        id="inicio"
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${lato.variable} antialiased flex flex-col min-h-screen scroll-pt-28`}
      >
        <CartProvider>
          <AnalyticsTracker />
          <Header />
          <div className="grow">
            {children}
          </div>
          <Footer />
        </CartProvider>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}