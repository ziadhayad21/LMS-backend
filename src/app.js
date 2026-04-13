import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { globalLimiter, authLimiter } from './middleware/rateLimiter.js';
import routes from './routes/index.js';

const app = express();

// Set trust proxy to true (usually needed for Render, Vercel, Heroku)
app.set('trust proxy', 1);

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow media from same server
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.up.railway.app'],
        mediaSrc: ["'self'", 'blob:', 'data:', '*', 'https://*.up.railway.app'],
        connectSrc: ["'self'", 'https://*.up.railway.app'],
      },
    },
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'https://lms-frontend.vercel.app',
  'https://lms-frontend-orcin-nine.vercel.app',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(o => o.trim()) : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ─── Rate Limiting ───────────────────────────────────────────────────────────
app.use('/api', globalLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// ─── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ─── Data Sanitization ───────────────────────────────────────────────────────
app.use(mongoSanitize()); // NoSQL injection prevention

// ─── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ─── Static Files ────────────────────────────────────────────────────────────
app.use(
  '/uploads',
  express.static('uploads', {
    maxAge: '1d',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.pdf')) {
        res.set('Content-Disposition', 'attachment');
      }
    },
  })
);

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ─── 404 Fallback ────────────────────────────────────────────────────────────
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Cannot find ${req.method} ${req.originalUrl} on this server`,
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(globalErrorHandler);

export default app;
