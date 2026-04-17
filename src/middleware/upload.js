import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { AppError } from '../utils/apiResponse.js';
import { FILE_LIMITS, ALLOWED_MIME_TYPES } from '../config/constants.js';

// ─── Storage Factories ────────────────────────────────────────────────────────

const diskStorage = (folder) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      const targetDir = `uploads/${folder}`;
      fs.mkdirSync(targetDir, { recursive: true });
      cb(null, targetDir);
    },
    filename:    (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext    = path.extname(file.originalname).toLowerCase();
      cb(null, `${file.fieldname}-${unique}${ext}`);
    },
  });

const fileFilter = (allowedTypes) => (_req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Invalid file type "${file.mimetype}". Allowed: ${allowedTypes.join(', ')}`,
        400
      ),
      false
    );
  }
};

// ─── Multer Instances ─────────────────────────────────────────────────────────

const pdfUpload = multer({
  storage:    diskStorage('pdfs'),
  limits:     { fileSize: FILE_LIMITS.PDF_MAX_BYTES },
  fileFilter: fileFilter(ALLOWED_MIME_TYPES.PDF),
}).single('file');

const imageUpload = multer({
  storage:    diskStorage('images'),
  limits:     { fileSize: FILE_LIMITS.IMAGE_MAX_BYTES },
  fileFilter: fileFilter(ALLOWED_MIME_TYPES.IMAGE),
}).single('image');

// ─── Error-Aware Wrappers ─────────────────────────────────────────────────────
// Multer throws its own error type — we wrap it so Express's global
// error handler can process it uniformly.

const wrapUpload = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File exceeds the maximum allowed size.', 413));
      }
      return next(new AppError(`Upload error: ${err.message}`, 400));
    }

    next(err); // Pass AppError or unknown errors down
  });
};

const lessonUpload = multer({
  storage:    multer.diskStorage({
    destination: (_req, file, cb) => {
      const folder = file.fieldname === 'video' ? 'videos' : 'lessons';
      const targetDir = `uploads/${folder}`;
      fs.mkdirSync(targetDir, { recursive: true });
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext    = path.extname(file.originalname).toLowerCase();
      cb(null, `${file.fieldname}-${unique}${ext}`);
    },
  }),
  limits:     { fileSize: FILE_LIMITS.VIDEO_MAX_BYTES }, 
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'video') {
      if (ALLOWED_MIME_TYPES.VIDEO.includes(file.mimetype)) cb(null, true);
      else cb(new AppError('Invalid video type.', 400), false);
    } else if (file.fieldname === 'pdf') {
      if (ALLOWED_MIME_TYPES.PDF.includes(file.mimetype)) cb(null, true);
      else cb(new AppError('Invalid PDF type.', 400), false);
    } else {
      cb(null, true);
    }
  }
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'pdf',   maxCount: 1 },
]);

export const uploadLessonFiles = wrapUpload(lessonUpload);
export const uploadPDF    = wrapUpload(pdfUpload);
export const uploadImage  = wrapUpload(imageUpload);
