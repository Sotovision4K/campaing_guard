import { Router } from 'express';
import multer from 'multer';
import {
  processData,
  listAnomalies,
  getAnomaly,
  rejectAnomaly,
  approveAnomaly,
  increaseBid,
  lowerBid,
  listAuditLogs,
} from '../controllers/anomaly.controller.js';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Upload and process CSV
router.post('/upload-csv', upload.single('file'), processData);

// List anomalies with optional filters
router.get('/', listAnomalies);

// Get single anomaly
router.get('/:id', getAnomaly);

// Reject anomaly (false positive)
router.post('/:id/reject', rejectAnomaly);

// Approve anomaly (acknowledge)
router.post('/:id/approve', approveAnomaly);

// Increase bid action
router.post('/:id/increase-bid', increaseBid);

// Lower bid action
router.post('/:id/lower-bid', lowerBid);

// Audit logs
router.get('/audit-logs', listAuditLogs);

export default router;
