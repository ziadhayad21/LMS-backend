import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { uploadImage } from '../middleware/upload.js';
import { sendSuccess, AppError } from '../utils/apiResponse.js';
import { authorize } from '../middleware/authorize.js';
import multer from 'multer';
import { ALLOWED_MIME_TYPES, FILE_LIMITS } from '../config/constants.js';
import { configureCloudinary } from '../config/cloudinary.js';
import { Readable } from 'stream';

const router = Router();

router.use(authenticate);

router.post('/image', uploadImage, (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please provide an image file', 400));
  }
  // Construct the URL path (since the app serves /uploads statically)
  const imageUrl = `${process.env.API_URL || 'https://lms-backend-production-3598.up.railway.app'}/uploads/images/${req.file.filename}`;
  sendSuccess(res, 201, { url: imageUrl });
});

// Cloudinary video upload (no local storage)
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_LIMITS.VIDEO_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.VIDEO.includes(file.mimetype)) cb(null, true);
    else cb(new AppError('Invalid video type.', 400), false);
  },
}).single('video');

router.post('/video', authorize('teacher', 'admin'), (req, res, next) => {
  videoUpload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError('Video exceeds the maximum allowed size.', 413));
    return next(err);
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('Please provide a video file', 400));

    const cloudinary = configureCloudinary();

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'english-lms/videos',
        },
        (error, uploaded) => {
          if (error) return reject(error);
          resolve(uploaded);
        }
      );

      Readable.from(req.file.buffer).pipe(uploadStream);
    });

    // Cloudinary returns secure_url
    sendSuccess(res, 201, {
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
      duration: result.duration,
      format: result.format,
    });
  } catch (e) {
    next(new AppError(e.message || 'Video upload failed.', 500));
  }
});

export default router;
