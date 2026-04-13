import { AppError } from '../utils/apiResponse.js';

export const requireActiveStudent = (req, _res, next) => {
  if (!req.user) return next(new AppError('Authentication required.', 401));

  // Teachers and Admins are not blocked by student-status rules.
  if (req.user.role === 'teacher' || req.user.role === 'admin') return next();

  if (req.user.role !== 'student') {
    return next(new AppError(`Invalid role "${req.user.role}".`, 403));
  }

  if (req.user.status !== 'active') {
    return next(
      new AppError(
        'Your account is pending teacher approval. You cannot access lesson content yet.',
        403
      )
    );
  }

  return next();
};
