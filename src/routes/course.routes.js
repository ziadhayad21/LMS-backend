import { Router } from 'express';
import {
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollInCourse,
  getCourseStudents,
  getTeacherDashboard,
} from '../controllers/course.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize }    from '../middleware/authorize.js';
import { uploadImage }  from '../middleware/upload.js';
import { createCourseValidator } from '../validators/course.validator.js';

const router = Router();

// Public
router.get('/',    getCourses);
router.get('/:id', getCourse);

// Protected
router.use(authenticate);

// Teacher dashboard
router.get('/teacher/dashboard', authorize('teacher'), getTeacherDashboard);

// Teacher only
router.post('/',    authorize('teacher'), uploadImage, createCourseValidator, createCourse);
router.patch('/:id', authorize('teacher'), uploadImage, updateCourse);
router.delete('/:id', authorize('teacher'), deleteCourse);
router.get('/:id/students', authorize('teacher'), getCourseStudents);

// Student only
router.post('/:id/enroll', authorize('student'), enrollInCourse);

export default router;
