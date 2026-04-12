import { Router } from 'express';
import {
  getLessons,
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  completeLesson,
} from '../controllers/lesson.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize }    from '../middleware/authorize.js';
import { uploadLessonFiles }  from '../middleware/upload.js';
import { createLessonValidator } from '../validators/course.validator.js';
import { requireActiveStudent } from '../middleware/requireActiveStudent.js';

// mergeParams allows access to :courseId from parent router
const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/',    requireActiveStudent, getLessons);
router.get('/:id', requireActiveStudent, getLesson);

router.post('/',    authorize('teacher'), uploadLessonFiles, createLessonValidator, createLesson);
router.patch('/:id', authorize('teacher'), uploadLessonFiles, updateLesson);
router.delete('/:id', authorize('teacher'), deleteLesson);

router.post('/:id/complete', authorize('student'), requireActiveStudent, completeLesson);

export default router;
