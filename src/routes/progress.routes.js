import { Router } from 'express';
import {
  getProgressOverview,
  getCourseProgress,
  getStudentProgress,
  getTrackingOverview,
} from '../controllers/progress.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize }    from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/overview',                    authorize('student'), getProgressOverview);
router.get('/tracking',                    authorize('teacher'), getTrackingOverview);
router.get('/course/:courseId',            authorize('student'), getCourseProgress);
router.get('/students/:studentId',         authorize('teacher'), getStudentProgress);

export default router;
