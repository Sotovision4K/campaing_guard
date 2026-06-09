import { Router } from 'express';
import anomalyRoutes from './anomaly.routes.js';

const router = Router();

router.use('/anomaly', anomalyRoutes);

export default router;
