import { Router } from 'express';
import {
  getMaterials,
  uploadMaterial,
  downloadMaterial,
  deleteMaterial,
} from '../controllers/material.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize }    from '../middleware/authorize.js';
import { uploadPDF }    from '../middleware/upload.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/',                           getMaterials);
router.get('/:id/download',              downloadMaterial);
router.post('/',   authorize('teacher'), uploadPDF, uploadMaterial);
router.delete('/:id', authorize('teacher'), deleteMaterial);

export default router;
