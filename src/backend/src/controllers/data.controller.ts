import { Request, Response, NextFunction } from 'express';
import { runPipeline } from '../services/pipeline.service.js';
import { ValidationError, FileProcessingError } from '../middleware/errors.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel'];

export const processData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype) && 
        !req.file.originalname.toLowerCase().endsWith('.csv')) {
      throw new ValidationError('Invalid file type. Only CSV files are allowed');
    }

    // Validate file size
    if (req.file.size > MAX_FILE_SIZE) {
      throw new ValidationError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const result = await runPipeline({ buffer: req.file.buffer });

    if (!result.success) {
      throw new FileProcessingError(
        `[${result.error.stage}] ${result.error.code}: ${result.error.message}`
      );
    }

    res.status(200).json({
      success: true,
      requestId: result.requestId,
      data: {
        report: result.report,
        anomaliesByCampaign: result.anomaliesByCampaign,
      },
    });
  } catch (error) {
    next(error);
  }
};