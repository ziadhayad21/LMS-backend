import { Router } from 'express';
import authRoutes     from './auth.routes.js';
import courseRoutes   from './course.routes.js';
import lessonRoutes   from './lesson.routes.js';
import lessonGlobalRoutes from './lesson-global.routes.js';
import materialRoutes from './material.routes.js';
import examRoutes     from './exam.routes.js';
import examGlobalRoutes from './exam-global.routes.js';
import uploadRoutes   from './upload.routes.js';
import resultRoutes   from './result.routes.js';
import progressRoutes from './progress.routes.js';
import followUpRoutes from './followUp.routes.js';

const router = Router();

router.use('/auth',                          authRoutes);
router.use('/upload',                        uploadRoutes);
router.use('/courses',                       courseRoutes);

router.use('/courses/:courseId/lessons',     lessonRoutes);
router.use('/lessons',                       lessonGlobalRoutes);
router.use('/courses/:courseId/materials',   materialRoutes);
router.use('/courses/:courseId/exams',       examRoutes);
router.use('/exams',                         examGlobalRoutes);
router.use('/results',                       resultRoutes);
router.use('/progress',                      progressRoutes);
router.use('/followups',                     followUpRoutes);


export default router;
