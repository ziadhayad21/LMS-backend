import { body } from 'express-validator';
import { COURSE_LEVELS, COURSE_CATEGORIES } from '../config/constants.js';
import { validate } from './auth.validator.js';

export const createCourseValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Course title is required')
    .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters'),

  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ max: 2000 }).withMessage('Description cannot exceed 2000 characters'),

  body('level')
    .notEmpty().withMessage('Level is required')
    .isIn(COURSE_LEVELS).withMessage(`Level must be one of: ${COURSE_LEVELS.join(', ')}`),

  body('category')
    .optional()
    .isIn(COURSE_CATEGORIES).withMessage(`Category must be one of: ${COURSE_CATEGORIES.join(', ')}`),

  body('tags')
    .optional()
    .customSanitizer((value) => {
      if (typeof value === 'string') return [value];
      return Array.isArray(value) ? value : [];
    }),

  validate,
];

export const createLessonValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Lesson title is required')
    .isLength({ max: 150 }).withMessage('Title cannot exceed 150 characters'),

  body('order')
    .optional()
    .isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),

  body('isPreview')
    .optional()
    .isBoolean().withMessage('isPreview must be a boolean'),

  validate,
];
