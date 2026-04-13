import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updatePassword,
  forgotPassword,
  resetPassword,
  listStudents,
  updateStudentStatus,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import {
  registerValidator,
  loginValidator,
  updatePasswordValidator,
  updateStudentStatusValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', registerValidator, register);
router.post('/login',    loginValidator,    login);
router.post('/logout',   authenticate,      logout);
router.get( '/me',       authenticate,      getMe);
router.patch('/update-password', authenticate, updatePasswordValidator, updatePassword);
router.post('/forgot-password', forgotPasswordValidator, forgotPassword);
router.patch('/reset-password/:token', resetPasswordValidator, resetPassword);
router.get('/students', authenticate, authorize('teacher', 'admin'), listStudents);
router.patch(
  '/students/:id/status',
  authenticate,
  authorize('teacher', 'admin'),
  updateStudentStatusValidator,
  updateStudentStatus
);

export default router;
