import jwt from 'jsonwebtoken';

const JWT_SECRET       = process.env.JWT_SECRET;
const JWT_EXPIRES_IN   = process.env.JWT_EXPIRES_IN   || '7d';
const COOKIE_EXPIRES_IN = parseInt(process.env.COOKIE_EXPIRES_IN, 10) || 7;

export const signToken = (userId, role) =>
  jwt.sign({ id: userId, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'english-lms',
  });

export const verifyToken = (token) =>
  jwt.verify(token, JWT_SECRET, { issuer: 'english-lms' });

/**
 * Signs a JWT, sets it as an HTTP-only cookie, and returns
 * a sanitized user object in the JSON response.
 */
export const setCookieAndRespond = (res, user, statusCode = 200) => {
  const token = signToken(user._id, user.role);

  const cookieOptions = {
    expires:  new Date(Date.now() + COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  };

  res.cookie('jwt', token, cookieOptions);

  // Strip password from response no matter what
  const safeUser = user.toObject ? user.toObject() : { ...user };
  delete safeUser.password;
  delete safeUser.passwordChangedAt;
  delete safeUser.passwordResetToken;
  delete safeUser.passwordResetExpires;

  return res.status(statusCode).json({
    status: 'success',
    data: { user: safeUser },
  });
};
