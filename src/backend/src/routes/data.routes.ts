import { Router } from 'express';
import multer from 'multer';
import { processData } from '../controllers/data.controller.js';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

router.post('/upload-csv', upload.single('file'), processData);

export default router;