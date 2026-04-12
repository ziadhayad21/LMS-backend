import { AppError } from '../utils/apiResponse.js';

/**
 * Role-Based Access Control middleware factory.
 * Usage: authorize('teacher')  or  authorize('student', 'teacher')
 *
 * Must be placed AFTER authenticate() in the middleware chain.
 */
export const authorize = (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required before authorization.', 401));
    }

    if (req.user.role !== 'admin' && !allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
          403
        )
      );
    }

    next();
  };
