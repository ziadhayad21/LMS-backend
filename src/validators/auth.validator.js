import { body, validationResult } from 'express-validator';
import { AppError } from '../utils/apiResponse.js';

// Runs validationResult and short-circuits with 400 on failure
export const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg).join('. ');
    return next(new AppError(messages, 400));
  }
  next();
};

export const registerValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),

  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^01[0125]\d{8}$/).withMessage('Please provide a valid Egyptian phone number (e.g. 01XXXXXXXXX)'),

  body('level')
    .notEmpty().withMessage('يرجى اختيار السنة الدراسية')
    .isIn([
      'أولى إعدادي',
      'تانية إعدادي',
      'تالتة إعدادي',
      'أولى ثانوي',
      'تانية ثانوي',
      'تالتة ثانوي',
    ]).withMessage('المستوى الدراسي غير صالح'),

  body('password')

    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/).withMessage('Password must contain at least one number'),

  validate,
];

export const loginValidator = [
  body('identifier')
    .custom((value, { req }) => {
      const v = String(value || req.body.email || '').trim();
      if (!v) throw new Error('Email or phone is required.');
      const isEmail = /^\S+@\S+\.\S+$/.test(v);
      const isEgPhone = /^01[0125]\d{8}$/.test(v.replace(/\s+/g, ''));
      if (!isEmail && !isEgPhone) {
        throw new Error('Please provide a valid email or Egyptian phone number.');
      }
      return true;
    }),

  body('password')
    .notEmpty().withMessage('Password is required'),

  validate,
];

export const updatePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('New password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('New password must contain a lowercase letter')
    .matches(/\d/).withMessage('New password must contain a number'),
  validate,
];

export const updateStudentStatusValidator = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['pending', 'active']).withMessage('Status must be "pending" or "active"'),
  validate,
];

export const forgotPasswordValidator = [
  body('identifier')
    .custom((value, { req }) => {
      const v = String(value || req.body.email || '').trim();
      if (!v) throw new Error('Email or phone number is required.');
      const isEmail = /^\S+@\S+\.\S+$/.test(v);
      const isPhone = /^01[0125]\d{8}$/.test(v.replace(/\s+/g, ''));
      if (!isEmail && !isPhone) throw new Error('Please provide a valid email or Egyptian phone number.');
      return true;
    }),
  validate,
];

export const verifyResetOtpValidator = [
  body('identifier').notEmpty().withMessage('Identifier is required'),
  body('otp')
    .trim()
    .matches(/^\d{6}$/).withMessage('OTP must be a 6-digit number'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('New password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('New password must contain a lowercase letter')
    .matches(/\d/).withMessage('New password must contain a number'),
  validate,
];

export const resetPasswordValidator = [
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('New password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('New password must contain a lowercase letter')
    .matches(/\d/).withMessage('New password must contain a number'),
  validate,
];
