import { body } from 'express-validator';
import { validate } from './auth.validator.js';

export const createFollowUpValidator = [
  body('studentId').notEmpty().withMessage('studentId is required'),
  body('type')
    .notEmpty().withMessage('type is required')
    .isIn(['note', 'reminder', 'feedback']).withMessage('type must be note, reminder, or feedback'),
  body('message')
    .trim()
    .notEmpty().withMessage('message is required')
    .isLength({ max: 2000 }).withMessage('message cannot exceed 2000 characters'),
  validate,
];

