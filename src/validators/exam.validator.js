import { body } from 'express-validator';
import { validate } from './auth.validator.js';

export const createExamValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Exam title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),

  body('questions')
    .isArray({ min: 1 }).withMessage('At least one question is required'),

  body('questions.*.questionText')
    .trim()
    .notEmpty().withMessage('Each question must have text'),

  body('questions.*.options')
    .if((value, { req, path }) => {
      const index = path.match(/\d+/)[0];
      return req.body.questions[index].type === 'multiple-choice';
    })
    .isArray({ min: 2 }).withMessage('Multiple choice questions must have at least 2 options'),

  body('questions.*.correctOptionIndex')
    .if((value, { req, path }) => {
      const index = path.match(/\d+/)[0];
      return req.body.questions[index].type === 'multiple-choice';
    })
    .isInt({ min: 0 }).withMessage('Multiple choice questions must have a correct option index'),

  body('questions.*.essayAnswer')
    .optional()
    .isString(),

  body('questions.*.points')
    .optional()
    .isInt({ min: 1, max: 10 }).withMessage('Points per question must be 1–10'),

  body('timeLimit')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Time limit must be at least 1 minute'),

  body('passingScore')
    .optional()
    .isInt({ min: 0, max: 100 }).withMessage('Passing score must be 0–100'),

  body('maxAttempts')
    .optional()
    .isInt({ min: -1 }).withMessage('maxAttempts must be -1 (unlimited) or a positive integer'),

  validate,
];

export const submitExamValidator = [
  body('answers')
    .isArray({ min: 1 }).withMessage('Answers array is required'),

  body('answers.*.questionId')
    .notEmpty().withMessage('Each answer must include a questionId'),

  body('answers.*.selectedOptionIndex')
    .optional()
    .isInt({ min: -1 }),

  body('answers.*.essayAnswer')
    .optional()
    .isString(),

  body('timeTakenSeconds')
    .optional()
    .isInt({ min: 0 }).withMessage('timeTakenSeconds must be a non-negative integer'),

  validate,
];
