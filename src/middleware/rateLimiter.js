import rateLimit from 'express-rate-limit';

const buildLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { status: 'fail', message },
    skipSuccessfulRequests: false,
  });

// General API: 200 requests per 15 minutes
export const globalLimiter = buildLimiter(
  15 * 60 * 1000,
  200,
  'Too many requests from this IP. Please try again after 15 minutes.'
);

// Auth routes: 10 attempts per 15 minutes (brute force protection)
export const authLimiter = buildLimiter(
  15 * 60 * 1000,
  10,
  'Too many authentication attempts. Please try again after 15 minutes.'
);

// File upload: 30 uploads per hour
export const uploadLimiter = buildLimiter(
  60 * 60 * 1000,
  30,
  'Too many file uploads. Please try again after an hour.'
);
