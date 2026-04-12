import { Router } from 'express';
import {
  getExams,
  getExam,
  getExamFull,
  createExam,
  updateExam,
  deleteExam,
  submitExam,
} from '../controllers/exam.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize }    from '../middleware/authorize.js';
import { createExamValidator, submitExamValidator } from '../validators/exam.validator.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/',        getExams);
router.get('/:id',     getExam);
router.get('/:id/full', authorize('teacher'), getExamFull);

router.post('/',       authorize('teacher'), createExamValidator, createExam);
router.patch('/:id',   authorize('teacher'), updateExam);
router.delete('/:id',  authorize('teacher'), deleteExam);

router.post('/:examId/submit', authorize('student'), submitExamValidator, submitExam);

export default router;
