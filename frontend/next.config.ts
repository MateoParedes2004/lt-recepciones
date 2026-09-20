import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Solo afecta al servidor de desarrollo: permite abrir el sitio por 127.0.0.1
  // (además de localhost) sin el aviso de "Cross origin request". Para probar
  // desde el celular por la IP de la red local, agregá acá esa IP.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // 1. Autorizamos a Cloudinary (ya lo tenías)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
    // 2. 👇 AGREGAMOS ESTO: Autorizamos la calidad 90
    qualities: [75, 90],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
