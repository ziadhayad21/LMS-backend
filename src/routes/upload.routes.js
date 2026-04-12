import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { uploadImage } from '../middleware/upload.js';
import { sendSuccess, AppError } from '../utils/apiResponse.js';

const router = Router();

router.use(authenticate);

router.post('/image', uploadImage, (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Please provide an image file', 400));
  }
  // Construct the URL path (since the app serves /uploads statically)
  const imageUrl = `${process.env.API_URL || 'http://localhost:5000'}/uploads/images/${req.file.filename}`;
  sendSuccess(res, 201, { url: imageUrl });
});

export default router;
