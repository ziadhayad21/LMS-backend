import User from '../models/User.model.js';
import { setCookieAndRespond } from '../utils/jwt.utils.js';
import { AppError } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import crypto from 'crypto';
import { sendEmail } from '../utils/email.js';

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

// ─── Register ─────────────────────────────────────────────────────────────────
export const register = asyncHandler(async (req, res, next) => {
  const { name, email, password, level } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return next(new AppError('An account with that email already exists.', 409));

  const user = await User.create({
    name,
    email,
    password,
    level,
    role: 'student',
    status: 'pending',
  });
  setCookieAndRespond(res, user, 201);
});


// ─── Login ────────────────────────────────────────────────────────────────────
export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // password is excluded by default — explicitly select it
  const user = await User.findOne({ email }).select('+password');

  if (!user || !user.isActive) {
    return next(new AppError('Invalid email or password.', 401));
  }

  const passwordOk = await user.comparePassword(password);
  if (!passwordOk) {
    return next(new AppError('Invalid email or password.', 401));
  }

  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  setCookieAndRespond(res, user, 200);
});

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logout = asyncHandler(async (_req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires:  new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
  res.status(200).json({ status: 'success', message: 'Logged out successfully.' });
});

// ─── Get Current User ─────────────────────────────────────────────────────────
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ status: 'success', data: { user: req.user } });
});


export const listStudents = asyncHandler(async (req, res) => {
  const filter = { role: 'student' };
  if (req.query.status) filter.status = req.query.status;

  const students = await User.find(filter)
    .select('name email status isActive createdAt lastLogin')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({ status: 'success', data: { students } });
});

export const updateStudentStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const student = await User.findOne({ _id: req.params.id, role: 'student' });
  if (!student) return next(new AppError('Student not found.', 404));

  student.status = status;
  await student.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: `Student status updated to "${status}".`,
    data: { student },
  });
});

// ─── Update Password ──────────────────────────────────────────────────────────
export const updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  user.password = newPassword;
  await user.save();

  setCookieAndRespond(res, user, 200);
});

// ─── Forgot / Reset Password ──────────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);

  const user = await User.findOne({ email, isActive: true });

  // Always return success to avoid account enumeration
  if (!user) {
    return res.status(200).json({
      status: 'success',
      message: 'If that email exists, a reset link has been sent.',
    });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await user.save({ validateBeforeSave: false });

  const clientUrl = (process.env.CLIENT_URL || 'https://lms-frontend.vercel.app').split(',')[0].trim();
  const resetUrl = `${clientUrl.replace(/\/$/, '')}/reset-password/${resetToken}`;

  await sendEmail({
    to: user.email,
    subject: 'Password reset',
    text: `Reset your password using this link (valid for 15 minutes): ${resetUrl}`,
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link is valid for 15 minutes.</p>
    `,
  });

  res.status(200).json({
    status: 'success',
    message: 'If that email exists, a reset link has been sent.',
  });
});

export const resetPassword = asyncHandler(async (req, res, next) => {
  const token = req.params.token;
  const { newPassword } = req.body;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
    isActive: true,
  }).select('+password');

  if (!user) {
    return next(new AppError('Reset token is invalid or has expired.', 400));
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Log the user in immediately after reset (keeps UX consistent)
  setCookieAndRespond(res, user, 200);
});
