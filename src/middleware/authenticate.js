import { verifyToken } from '../utils/jwt.utils.js';
import User from '../models/User.model.js';
import { AppError } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  // 1. Extract token from HTTP-only cookie OR Authorization header
  let token;
  if (req.cookies?.jwt && req.cookies.jwt !== 'loggedout') {
    token = req.cookies.jwt;
  } else if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

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

  // Static admin account (not stored in DB)
  if (decoded?.role === 'admin' && decoded?.id === 'admin') {
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!adminEmail) {
      return next(new AppError('Admin is not configured.', 500));
    }
    req.user = {
      id: 'admin',
      _id: 'admin',
      role: 'admin',
      status: 'active',
      name: 'Admin',
      email: adminEmail,
      isActive: true,
    };
    return next();
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
  if (!['teacher', 'student'].includes(currentUser.role)) {
    return next(new AppError(`Invalid role "${currentUser.role}".`, 403));
  }

  if (!['pending', 'active'].includes(currentUser.status)) {
    return next(new AppError(`Invalid account status "${currentUser.status}".`, 403));
  }

  req.user = currentUser;
  next();
});
