import { Router } from 'express';
import { getGlobalExams, getExam, createExam, submitExam } from '../controllers/exam.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize }    from '../middleware/authorize.js';
import { createExamValidator, submitExamValidator } from '../validators/exam.validator.js';


const router = Router();

router.use(authenticate);

router.get('/',    getGlobalExams);
router.get('/:id', getExam);

router.post('/',               authorize('teacher'), createExamValidator, createExam);
router.post('/:examId/submit', authorize('student'), submitExamValidator, submitExam);

export default router;

