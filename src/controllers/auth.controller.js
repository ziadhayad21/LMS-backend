import User from '../models/User.model.js';
import { setCookieAndRespond, signToken } from '../utils/jwt.utils.js';
import { AppError } from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import bcrypt from 'bcryptjs';

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const loginStaticAdmin = async (email, password, res, next) => {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';

  if (!adminEmail) return false;
  if (normalizeEmail(email) !== adminEmail) return false;

  let ok = false;
  if (adminPasswordHash) {
    ok = await bcrypt.compare(password || '', adminPasswordHash);
  } else if (adminPassword) {
    ok = password === adminPassword;
  }

  if (!ok) return next(new AppError('Invalid email or password.', 401));

  const token = signToken('admin', 'admin');
  res.cookie('jwt', token, {
    expires:  new Date(Date.now() + (parseInt(process.env.COOKIE_EXPIRES_IN || '7', 10) || 7) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });

  return res.status(200).json({
    status: 'success',
    data: {
      user: {
        _id: 'admin',
        name: 'Admin',
        email: adminEmail,
        role: 'admin',
        status: 'active',
        isActive: true,
        enrolledCourses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  });
};

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

  // Static admin login (single account)
  const adminHandled = await loginStaticAdmin(email, password, res, next);
  if (adminHandled) return;

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
  if (req.user?.role === 'admin') {
    return res.status(200).json({ status: 'success', data: { user: req.user } });
  }
  const user = await User.findById(req.user.id);
  res.status(200).json({ status: 'success', data: { user } });
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
