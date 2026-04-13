import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export const configureCloudinary = () => {
  if (configured) return cloudinary;

  const { CLOUD_NAME, API_KEY, API_SECRET } = process.env;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    throw new Error('Cloudinary is not configured. Please set CLOUD_NAME, API_KEY, API_SECRET.');
  }

  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });

  configured = true;
  return cloudinary;
};

export default cloudinary;

