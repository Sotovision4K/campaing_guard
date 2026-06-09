import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import routes from '../index';
import { errorHandler } from '../../middleware/error-handler';
import { requestId } from '../../middleware/request-id';

vi.mock('../../services/pipeline.service.js', () => ({
  runPipeline: vi.fn(),
}));

vi.mock('../../db/index.js', () => ({
  initDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db/repositories/report.repository.js', () => ({
  findReportByHash: vi.fn().mockResolvedValue(null),
  createReport: vi.fn().mockResolvedValue({ report_id: 'report-1' }),
}));

vi.mock('../../db/repositories/anomaly.repository.js', () => ({
  createAnomaly: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../db/repositories/audit-log.repository.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

const app = express();
app.use(express.json());
app.use(requestId);
app.use('/api/v1', routes);
app.use(errorHandler);

describe('POST /api/v1/anomaly/upload-csv', () => {
  const validCSV = `campaign_id,date,impressions,clicks,spend,orders,sales,acos,cpc,ctr
CMP-001,2024-01-15,10000,500,100.50,25,1250.00,0.08,0.20,0.05
CMP-002,2024-01-16,8000,400,80.00,20,1000.00,0.08,0.20,0.05`;

  it('should successfully process a valid CSV file', async () => {
    const { runPipeline } = await import('../../services/pipeline.service.js');
    vi.mocked(runPipeline).mockResolvedValueOnce({
      success: true,
      requestId: 'test-request-id',
      report: {
        id: 'report-1',
        totalRows: 2,
        validRows: 2,
        regimesDetected: 1,
        anomaliesFound: 0,
        bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        processingTime_ms: 100,
      },
      anomaliesByCampaign: {},
    });

    const response = await request(app)
      .post('/api/v1/anomaly/upload-csv')
      .attach('file', Buffer.from(validCSV), 'test.csv');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.report.totalRows).toBe(2);
    expect(response.body.data.report.validRows).toBe(2);
  });

  it('should return requestId in response', async () => {
    const { runPipeline } = await import('../../services/pipeline.service.js');
    vi.mocked(runPipeline).mockResolvedValueOnce({
      success: true,
      requestId: 'mock-request-id',
      report: {
        id: 'report-1',
        totalRows: 1,
        validRows: 1,
        regimesDetected: 1,
        anomaliesFound: 0,
        bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        processingTime_ms: 50,
      },
      anomaliesByCampaign: {},
    });

    const response = await request(app)
      .post('/api/v1/anomaly/upload-csv')
      .attach('file', Buffer.from(validCSV), 'test.csv');

    expect(response.body.requestId).toBe('mock-request-id');
  });

  it('should return 400 when no file is uploaded', async () => {
    const response = await request(app).post('/api/v1/anomaly/upload-csv');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('No file uploaded');
  });

  it('should reject non-CSV files', async () => {
    const response = await request(app)
      .post('/api/v1/anomaly/upload-csv')
      .attach('file', Buffer.from('not a csv'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle pipeline failure', async () => {
    const { runPipeline } = await import('../../services/pipeline.service.js');
    vi.mocked(runPipeline).mockResolvedValueOnce({
      success: false,
      requestId: 'fail-request-id',
      error: {
        code: 'DATA_QUALITY_ERROR',
        message: 'Empty file',
        stage: 'data_quality',
      },
    });

    const response = await request(app)
      .post('/api/v1/anomaly/upload-csv')
      .attach('file', Buffer.from(''), 'empty.csv');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('FILE_PROCESSING_ERROR');
  });
});
