import { Router } from 'express';
import { getGlobalExams, getExam, createExam, submitExam, updateGlobalExam, deleteGlobalExam } from '../controllers/exam.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize }    from '../middleware/authorize.js';
import { createExamValidator, submitExamValidator } from '../validators/exam.validator.js';


const router = Router();

router.use(authenticate);

router.get('/',    getGlobalExams);
router.get('/:id', getExam);

router.post('/',               authorize('teacher', 'admin'), createExamValidator, createExam);
router.patch('/:id',           authorize('teacher', 'admin'), updateGlobalExam);
router.delete('/:id',          authorize('teacher', 'admin'), deleteGlobalExam);
router.post('/:examId/submit', authorize('student'), submitExamValidator, submitExam);

export default router;

