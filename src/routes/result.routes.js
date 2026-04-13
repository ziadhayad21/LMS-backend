import { Router } from 'express';
import { getMyResults, getCourseResults, getResult, getLeaderboard } from '../controllers/result.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/my', authorize('student'), getMyResults);
router.get('/leaderboard', authorize('student'), getLeaderboard);
router.get('/course/:courseId', authorize('teacher'), getCourseResults);
router.get('/:id', getResult);

export default router;
