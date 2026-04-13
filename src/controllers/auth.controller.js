import User from '../models/User.model.js';
import { setCookieAndRespond } from '../utils/jwt.utils.js';
import { AppError } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import crypto from 'crypto';
import { sendEmail } from '../utils/email.js';

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const normalizePhone = (phone) => String(phone || '').replace(/\s+/g, '').trim();

// ─── Register ─────────────────────────────────────────────────────────────────
export const register = asyncHandler(async (req, res, next) => {
  const { name, email, phone, password, level } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  const exists = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
  }).lean();
  if (exists?.email === normalizedEmail) {
    return next(new AppError('An account with that email already exists.', 409));
  }
  if (exists?.phone === normalizedPhone) {
    return next(new AppError('An account with that phone number already exists.', 409));
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    phone: normalizedPhone,
    password,
    level,
    role: 'student',
    status: 'pending',
  });
  setCookieAndRespond(res, user, 201);
});


// ─── Login ────────────────────────────────────────────────────────────────────
export const login = asyncHandler(async (req, res, next) => {
  // Accept either { identifier } or legacy { email } as the login field
  const identifierRaw = req.body.identifier ?? req.body.email;
  const password = req.body.password;

  const identifier = String(identifierRaw || '').trim();
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedPhone = normalizePhone(identifier);

  // password is excluded by default — explicitly select it
  const user = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
  }).select('+password');

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
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const identifier = String(req.body.identifier || '').trim();
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedPhone = normalizePhone(identifier);

  const user = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    isActive: true,
  });

  // Always return success to avoid account enumeration
  if (!user) {
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists, a reset code has been sent.',
    });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  user.passwordResetToken = hashedOtp;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save({ validateBeforeSave: false });

  // In a real app, send actual SMS if it was a phone. 
  // For now, we use email if available, or just respond (mocking SMS).
  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${otp}. It is valid for 10 minutes.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #334155;">
          <h2 style="color: #0f172a;">Password Reset Code</h2>
          <p>Use the following code to reset your password:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 12px; background: #f1f5f9; border-radius: 8px; display: inline-block; margin: 16px 0;">
            ${otp}
          </div>
          <p style="font-size: 14px; color: #64748b;">This code is valid for 10 minutes.</p>
        </div>
      `,
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'If an account exists, a reset code has been sent.',
  });
});

export const verifyResetOtp = asyncHandler(async (req, res, next) => {
  const { identifier, otp, newPassword } = req.body;
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedPhone = normalizePhone(identifier);

  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

  const user = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    passwordResetToken: hashedOtp,
    passwordResetExpires: { $gt: new Date() },
    isActive: true,
  }).select('+password');

  if (!user) {
    return next(new AppError('Invalid or expired reset code.', 400));
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  setCookieAndRespond(res, user, 200);
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
