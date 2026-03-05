/** @type {import('next').NextConfig} */
const nextConfig = {
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
  },
};

export default nextConfig;