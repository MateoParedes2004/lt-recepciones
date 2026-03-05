import { v2 as cloudinary } from 'cloudinary';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  useFactory: () => {
    return cloudinary.config({
      // Al tener CLOUDINARY_URL en el .env, esto se conecta automáticamente
    });
  },
};