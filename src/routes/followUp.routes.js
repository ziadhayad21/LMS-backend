import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { createFollowUp, listFollowUpsForStudent } from '../controllers/followUp.controller.js';
import { createFollowUpValidator } from '../validators/followUp.validator.js';

const router = Router();

router.use(authenticate);
router.use(authorize('teacher'));

router.post('/', createFollowUpValidator, createFollowUp);
router.get('/students/:studentId', listFollowUpsForStudent);

export default router;

