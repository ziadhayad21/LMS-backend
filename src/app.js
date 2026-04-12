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
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:', 'blob:'],
        mediaSrc:   ["'self'", 'blob:'],
      },
    },
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (like server-to-server / curl) with no Origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

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
