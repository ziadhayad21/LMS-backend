import { Router } from 'express';
import {
  getAllLessons,
  createAcademicLesson,
} from '../controllers/lesson.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { requireActiveStudent } from '../middleware/requireActiveStudent.js';
import { uploadLessonFiles } from '../middleware/upload.js';
import { createLessonValidator } from '../validators/course.validator.js';

const router = Router();

router.use(authenticate);
router.get('/', requireActiveStudent, getAllLessons);
router.post(
  '/',
  authorize('teacher'),
  uploadLessonFiles,
  createLessonValidator,
  createAcademicLesson
);

export default router;
