import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runPipeline } from '../services/pipeline.service.js';
import { computeFileHash } from '../utils/hash.js';
import { ValidationError, FileProcessingError, NotFoundError } from '../middleware/errors.js';
import { initDatabase } from '../db/index.js';
import { createReport, findReportByHash } from '../db/repositories/report.repository.js';
import { createAnomaly, findAnomaliesByReportId, findAnomalyById, updateAnomalyStatus, getAnomaliesWithPagination } from '../db/repositories/anomaly.repository.js';
import { createAuditLog, findAuditLogsByAnomalyId, getAuditLogsWithPagination } from '../db/repositories/audit-log.repository.js';
import type { ValidatedAnomaly } from '../interfaces/pipeline.interface.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel'];

// Ensure DB is initialized
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

export const processData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await ensureDb();

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

    const fileHash = computeFileHash(req.file.buffer);

    // Check if file has already been processed
    const existingReport = await findReportByHash(fileHash);
    if (existingReport) {
      // Return stored analysis
      const anomalies = await findAnomaliesByReportId(existingReport.report_id);
      const auditLogs = await createAuditLog({
        report_id: existingReport.report_id,
        action: 'file_deduplication',
        actor: req.headers['x-user-id'] as string || 'anonymous',
        meta: {
          fileHash,
          filename: req.file.originalname,
          message: 'File already processed; returning stored analysis.',
        },
      });

      // Group anomalies by campaign for response compatibility
      const anomaliesByCampaign: Record<string, ValidatedAnomaly[]> = {};
      for (const a of anomalies) {
        if (!anomaliesByCampaign[a.campaign_id]) {
          anomaliesByCampaign[a.campaign_id] = [];
        }
        const snapshot = a.feature_snapshot as Record<string, unknown> || {};
        anomaliesByCampaign[a.campaign_id].push({
          id: a.anomaly_id,
          campaignId: a.campaign_id,
          date: a.date || '',
          type: a.anomaly_type as ValidatedAnomaly['type'],
          severity: a.severity as ValidatedAnomaly['severity'],
          title: a.label || a.anomaly_type,
          insight: (snapshot.insight as string) || `Anomaly detected: ${a.anomaly_type} with severity ${a.severity} (count: ${a.count})`,
          suggestedAction: (snapshot.suggestedAction as string) || 'Review anomaly details and take appropriate action.',
          confidence: (snapshot.confidence as number) || 0.9,
          metadata: a.feature_snapshot as unknown as ValidatedAnomaly['metadata'],
        });
      }

      res.status(200).json({
        success: true,
        requestId: uuidv4(),
        cached: true,
        data: {
          report: {
            id: existingReport.report_id,
            totalRows: existingReport.row_count,
            validRows: existingReport.row_count,
            regimesDetected: 0,
            anomaliesFound: anomalies.length,
            bySeverity: anomalies.reduce((acc, a) => {
              acc[a.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'] = (acc[a.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'] || 0) + 1;
              return acc;
            }, { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }),
            processingTime_ms: 0,
          },
          anomaliesByCampaign,
        },
      });
      return;
    }

    // Run pipeline
    const result = await runPipeline({ buffer: req.file.buffer });

    if (!result.success) {
      throw new FileProcessingError(
        `[${result.error.stage}] ${result.error.code}: ${result.error.message}`
      );
    }

    // Store report
    const report = await createReport({
      file_hash: fileHash,
      filename: req.file.originalname,
      row_count: result.report.totalRows,
      status: 'completed',
      meta: {
        requestId: result.requestId,
        regimesDetected: result.report.regimesDetected,
        processingTime_ms: result.report.processingTime_ms,
      },
    });

    // Store anomalies (deduplicate by campaign/type/date)
    const allAnomalies: ValidatedAnomaly[] = [];
    for (const campaignId in result.anomaliesByCampaign) {
      for (const anomaly of result.anomaliesByCampaign[campaignId]) {
        allAnomalies.push(anomaly);
        const isPending = anomaly.title.startsWith('[PENDING]');
        await createAnomaly({
          report_id: report.report_id,
          campaign_id: anomaly.campaignId,
          date: anomaly.date,
          anomaly_type: anomaly.type,
          severity: anomaly.severity,
          label: anomaly.title,
          feature_snapshot: {
            insight: anomaly.insight,
            suggestedAction: anomaly.suggestedAction,
            confidence: anomaly.confidence,
            metadata: anomaly.metadata,
          },
          status: isPending ? 'pending_insight' : 'open',
        });
      }
    }

    // Audit log for insight generation
    await createAuditLog({
      report_id: report.report_id,
      action: 'llm_insight_request',
      actor: req.headers['x-user-id'] as string || 'anonymous',
      llm_prompt: 'Pipeline anomaly detection and LLM validation executed.',
      llm_response: `Generated ${allAnomalies.length} anomalies.`,
      llm_insight: {
        anomaliesFound: allAnomalies.length,
        bySeverity: result.report.bySeverity,
      },
    });

    res.status(200).json({
      success: true,
      requestId: result.requestId,
      data: {
        report: {
          ...result.report,
          id: report.report_id,
        },
        anomaliesByCampaign: result.anomaliesByCampaign,
      },
    });
  } catch (error) {
    next(error);
  }
};

// List anomalies with filters
export const listAnomalies = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await ensureDb();

    const { reportId, campaignId, status, severity, limit, offset } = req.query;

    const result = await getAnomaliesWithPagination(
      {
        reportId: reportId as string | undefined,
        campaignId: campaignId as string | undefined,
        status: status as string | undefined,
        severity: severity as string | undefined,
      },
      limit ? parseInt(limit as string, 10) : 50,
      offset ? parseInt(offset as string, 10) : 0
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Get single anomaly with audit logs
export const getAnomaly = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await ensureDb();

    const { id } = req.params;
    const anomaly = await findAnomalyById(id);
    if (!anomaly) {
      throw new NotFoundError(`Anomaly with id ${id} not found`);
    }

    const auditLogs = await findAuditLogsByAnomalyId(id);

    res.status(200).json({
      success: true,
      data: {
        anomaly,
        auditLogs,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Reject anomaly (false positive)
export const rejectAnomaly = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await ensureDb();

    const { id } = req.params;
    const { reason } = req.body;

    const anomaly = await findAnomalyById(id);
    if (!anomaly) {
      throw new NotFoundError(`Anomaly with id ${id} not found`);
    }

    const updated = await updateAnomalyStatus(id, 'rejected');

    // Audit log for user action
    await createAuditLog({
      report_id: anomaly.report_id,
      anomaly_id: id,
      action: 'reject_anomaly',
      actor: req.headers['x-user-id'] as string || 'anonymous',
      meta: {
        reason: reason || 'User marked as false positive.',
        previousStatus: anomaly.status,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Anomaly rejected.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Approve anomaly (acknowledge and proceed)
export const approveAnomaly = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await ensureDb();

    const { id } = req.params;
    const { reason, action } = req.body;

    const anomaly = await findAnomalyById(id);
    if (!anomaly) {
      throw new NotFoundError(`Anomaly with id ${id} not found`);
    }

    const updated = await updateAnomalyStatus(id, 'approved');

    // Audit log for user action
    await createAuditLog({
      report_id: anomaly.report_id,
      anomaly_id: id,
      action: 'approve_anomaly',
      actor: req.headers['x-user-id'] as string || 'anonymous',
      meta: {
        reason: reason || 'User acknowledged anomaly.',
        actionTaken: action || 'none',
        previousStatus: anomaly.status,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Anomaly approved. DONE!',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Increase bid action — persists user selection as 'investigating' + audit log
export const increaseBid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await ensureDb();

    const { id } = req.params;
    const { percent } = req.body;
    const pct = typeof percent === 'number' && percent > 0 ? percent : 10;

    const anomaly = await findAnomalyById(id);
    if (!anomaly) {
      throw new NotFoundError(`Anomaly with id ${id} not found`);
    }

    const updated = await updateAnomalyStatus(id, 'investigating');

    await createAuditLog({
      report_id: anomaly.report_id,
      anomaly_id: id,
      action: 'increase_bid',
      actor: req.headers['x-user-id'] as string || 'anonymous',
      meta: {
        percent: pct,
        message: `Bid increased by ${pct}%. DONE!`,
        previousStatus: anomaly.status,
        newStatus: 'investigating',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Bid increased. DONE!',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Lower bid action — persists user selection as 'investigating' + audit log
export const lowerBid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await ensureDb();

    const { id } = req.params;
    const { percent } = req.body;
    const pct = typeof percent === 'number' && percent > 0 ? percent : 10;

    const anomaly = await findAnomalyById(id);
    if (!anomaly) {
      throw new NotFoundError(`Anomaly with id ${id} not found`);
    }

    const updated = await updateAnomalyStatus(id, 'investigating');

    await createAuditLog({
      report_id: anomaly.report_id,
      anomaly_id: id,
      action: 'lower_bid',
      actor: req.headers['x-user-id'] as string || 'anonymous',
      meta: {
        percent: pct,
        message: `Bid lowered by ${pct}%. DONE!`,
        previousStatus: anomaly.status,
        newStatus: 'investigating',
      },
    });

    res.status(200).json({
      success: true,
      message: 'Bid lowered. DONE!',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// Bulk action: approve / reject a list of anomalies in one call
export const bulkAction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await ensureDb();

    const { ids, action, reason } = req.body as {
      ids: unknown;
      action: unknown;
      reason?: string;
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('`ids` must be a non-empty array');
    }
    if (action !== 'approved' && action !== 'rejected') {
      throw new ValidationError('`action` must be either "approved" or "rejected"');
    }

    const actor = (req.headers['x-user-id'] as string) || 'anonymous';
    const updated: unknown[] = [];
    const skipped: string[] = [];

    for (const id of ids) {
      if (typeof id !== 'string') {
        skipped.push(String(id));
        continue;
      }
      const anomaly = await findAnomalyById(id);
      if (!anomaly) {
        skipped.push(id);
        continue;
      }
      const result = await updateAnomalyStatus(id, action);
      if (result) updated.push(result);
      await createAuditLog({
        report_id: anomaly.report_id,
        anomaly_id: id,
        action: action === 'approved' ? 'approve_anomaly' : 'reject_anomaly',
        actor,
        meta: {
          bulk: true,
          reason: reason || (action === 'approved' ? 'Bulk approved.' : 'Bulk rejected.'),
          previousStatus: anomaly.status,
          newStatus: action,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${action}: ${updated.length} updated, ${skipped.length} skipped.`,
      data: { updated, skipped },
    });
  } catch (error) {
    next(error);
  }
};

// List audit logs
export const listAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await ensureDb();

    const { anomalyId, reportId, action, actor, limit, offset } = req.query;

    const result = await getAuditLogsWithPagination(
      {
        anomalyId: anomalyId as string | undefined,
        reportId: reportId as string | undefined,
        action: action as string | undefined,
        actor: actor as string | undefined,
      },
      limit ? parseInt(limit as string, 10) : 50,
      offset ? parseInt(offset as string, 10) : 0
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
