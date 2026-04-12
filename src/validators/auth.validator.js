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
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email address')
    .normalizeEmail(),

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
