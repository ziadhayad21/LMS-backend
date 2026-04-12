import { AppError } from '../utils/apiResponse.js';

// ─── Error Transformers ───────────────────────────────────────────────────────

const handleCastError = (err) =>
  new AppError(`Invalid ${err.path}: "${err.value}" is not a valid ID.`, 400);

const handleDuplicateKey = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return new AppError(
    `"${err.keyValue[field]}" is already in use. Please choose a different ${field}.`,
    409
  );
};

const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(`Validation failed: ${messages.join('. ')}`, 400);
};

const handleJWTError      = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpired    = () => new AppError('Your token has expired. Please log in again.', 401);

// ─── Response Formatters ──────────────────────────────────────────────────────

const sendDev = (err, res) =>
  res.status(err.statusCode).json({
    status:  err.status,
    message: err.message,
    stack:   err.stack,
    error:   err,
  });

const sendProd = (err, res) => {
  // Operational: safe to expose message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({ status: err.status, message: err.message });
  }
  // Programming / unknown: never leak details
  console.error('💥 UNEXPECTED ERROR:', err);
  return res.status(500).json({ status: 'error', message: 'Something went wrong on our end.' });
};

// ─── Global Handler ───────────────────────────────────────────────────────────

export const globalErrorHandler = (err, req, res, next) => {
  // Keep Express error-handler signature (4 args) while satisfying lint.
  void next;
  err.statusCode = err.statusCode || 500;
  err.status     = err.status     || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendDev(err, res);
  } else {
    let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
    error.message = err.message;

    if (error.name === 'CastError')          error = handleCastError(error);
    if (error.code  === 11000)               error = handleDuplicateKey(error);
    if (error.name === 'ValidationError')    error = handleValidationError(error);
    if (error.name === 'JsonWebTokenError')  error = handleJWTError();
    if (error.name === 'TokenExpiredError')  error = handleJWTExpired();

    sendProd(error, res);
  }
};
