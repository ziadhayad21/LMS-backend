import { Router } from 'express';
import { getAllLessons } from '../controllers/lesson.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireActiveStudent } from '../middleware/requireActiveStudent.js';

const router = Router();

router.use(authenticate);

// GET /lessons — list lessons (students get filtered by level, teachers get their own)
router.get('/', requireActiveStudent, getAllLessons);

// NOTE: POST /lessons is intentionally removed.
// Lessons MUST be created through POST /courses/:courseId/lessons
// to enforce the course-first relationship.

export default router;
