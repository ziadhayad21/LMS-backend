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
export const forgotPassword = asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedPhone = normalizePhone(identifier);

  const user = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    isActive: true,
  });

  if (!user) {
    // eslint-disable-next-line no-console
    console.warn(`[auth] Password reset requested for non-existent user: ${identifier}`);
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists, a reset link has been sent to the associated email.',
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[auth] User found for reset: ${user.email}. Sending email...`);

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim();
  const resetUrl = `${clientUrl.replace(/\/$/, '')}/reset-password/${resetToken}`;

  if (user.email) {
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        text: `Click this link to reset your password (valid for 1 hour): ${resetUrl}`,
        html: `
          <div style="font-family: sans-serif; padding: 40px; background-color: #f8fafc; border-radius: 16px;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 32px; border-radius: 20px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h1 style="color: #0f172a; font-size: 24px; margin-bottom: 16px;">Reset Your Password</h1>
              <p style="color: #475569; font-size: 16px; line-height: 1.5;">We received a request to reset your password. Click the button below to choose a new one.</p>
              <div style="margin: 32px 0;">
                <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
              <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">If the button doesn't work, copy and paste this link: <br> <span style="color: #6366f1;">${resetUrl}</span></p>
            </div>
          </div>
        `,
      });

      
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists, a reset link has been sent to the associated email.',
      });
    } catch (err) {
      // Don't reveal delivery errors to the client; avoid breaking UX.
      // Log for ops and still return a generic success response.
      // eslint-disable-next-line no-console
      console.error('[email-error]', err?.message || err);
      return res.status(200).json({
        status: 'success',
        message: 'If an account exists, a reset link has been sent to the associated email.',
      });
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'If an account exists, a reset link has been sent to the associated email.',
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
