/**
 * Operational error class.
 * Used for errors we create intentionally (validation, auth, etc.)
 * as opposed to programming errors. The `isOperational` flag tells
 * the global error handler to send the message to the client safely.
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standardized success response helper.
 */
export const sendSuccess = (res, statusCode = 200, data = {}, meta = {}) => {
  const payload = { status: 'success', data };
  if (Object.keys(meta).length) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

/**
 * Build pagination meta from query params.
 */
export const getPaginationMeta = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});
