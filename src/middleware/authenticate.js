import { verifyToken } from '../utils/jwt.utils.js';
import User from '../models/User.model.js';
import { AppError } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  console.log('--- Auth Middleware ---');
  console.log('Incoming cookies:', req.cookies);
  // 1. Extract token ONLY from HTTP-only cookie
  let token;
  if (req.cookies?.jwt && req.cookies.jwt !== 'loggedout') {
    token = req.cookies.jwt;
  }

  console.log('Extracted JWT from cookie:', token ? 'yes' : 'no');

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to access this resource.', 401));
  }

  // 2. Verify signature and expiry
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid authentication token.', 401));
  }

  // 3. Confirm user still exists and is active
  const currentUser = await User.findById(decoded.id).select('+passwordChangedAt');
  if (!currentUser || !currentUser.isActive) {
    return next(new AppError('This account no longer exists or has been deactivated.', 401));
  }

  // 4. Reject tokens issued before a password change
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password was recently changed. Please log in again.', 401));
  }

  // Grant access — attach full user to request
  if (!['teacher', 'student', 'admin'].includes(currentUser.role)) {
    return next(new AppError(`Invalid role "${currentUser.role}".`, 403));
  }

  if (!['pending', 'active'].includes(currentUser.status)) {
    return next(new AppError(`Invalid account status "${currentUser.status}".`, 403));
  }

  req.user = currentUser;
  next();
});
