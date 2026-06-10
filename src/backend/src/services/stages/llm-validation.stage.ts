import Anthropic from '@anthropic-ai/sdk';
import {
  RawFinding,
  ValidatedAnomaly,
  LLMValidationResult,
  Severity,
  AnomalyType,
  LLM_BATCH_SIZE,
  LLM_MAX_RETRIES,
  LLM_MAX_TOKENS,
  TOP_ANOMALIES_PER_CAMPAIGN,
  LLM_MODEL_VALIDATION,
  LLM_MODEL_DEEP_INSIGHT,
  SEVERITY_WEIGHT,
} from '../../interfaces/pipeline.interface.js';
import {
  LLMError,
  LLMConfigError,
  LLMResponseParseError,
} from '../../middleware/errors.js';

const ANOMALY_VALIDATION_PROMPT = `You are an Amazon PPC anomaly validator. The finding object already contains id, campaignId, date, type, and severity. Only return enriched fields.

{
  "anomalies": [
    {
      "id": "original-id",
      "title": "Short title (max 50 chars)",
      "insight": "1 sentence explaining business impact",
      "suggestedAction": "Specific action",
      "confidence": 0.0-1.0,
      "metadata": { "metric": "", "value": 0, "baseline": 0, "zScore": 0, "regimeId": "" }
    }
  ],
  "filtered": [ { "id": "", "reason": "" } ]
}

Include only validated true anomalies in "anomalies". Move false positives to "filtered" with a reason.`;

const DEFAULT_SEVERITY_MAP: Record<AnomalyType, Severity> = {
  CLICKS_EXCEED_IMPRESSIONS: 'CRITICAL',
  SPEND_WITHOUT_CLICKS: 'HIGH',
  ACOS_SPIKE: 'HIGH',
  MONEY_LEAKAGE: 'CRITICAL',
  ROAS_DROP_CRITICAL: 'CRITICAL',
  ROAS_DROP: 'MEDIUM',
  CVR_ANOMALY: 'MEDIUM',
  CTR_DROP: 'MEDIUM',
  ZERO_ACTIVITY_CAMPAIGN: 'LOW',
};

const logger = {
  info: (msg: string, ...args: unknown[]) => console.log(`[LLMValidationStage] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`[LLMValidationStage] ${msg}`, ...args),
};

/**
 * Extracts a JSON object/array from text that may be wrapped in markdown
 * code fences or contain extra prose before/after the JSON payload.
 */
function extractJSON(text: string): string {
  const trimmed = text.trim();

  // Strip markdown fences: ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to locate the first '{' or '[' and the matching last '}' or ']'
  const firstBrace = trimmed.search(/[{[]/);
  if (firstBrace !== -1) {
    const lastBrace = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
    if (lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }
  }

  return trimmed;
}

const DEFAULT_TITLES: Record<AnomalyType, string> = {
  CLICKS_EXCEED_IMPRESSIONS: 'Data integrity error: clicks > impressions',
  SPEND_WITHOUT_CLICKS: 'Spending without any clicks',
  ACOS_SPIKE: 'Advertising cost spike detected',
  MONEY_LEAKAGE: 'Revenue declining while spend increases',
  ROAS_DROP_CRITICAL: 'ROAS below breakeven (< 1)',
  ROAS_DROP: 'Significant ROAS decline',
  CVR_ANOMALY: 'Conversion rate anomaly',
  CTR_DROP: 'Click-through rate decline',
  ZERO_ACTIVITY_CAMPAIGN: 'Campaign inactive for extended period',
};

function getFindingSeverity(finding: RawFinding): Severity {
  return finding.severityHint || DEFAULT_SEVERITY_MAP[finding.type];
}

/**
 * Calculate a combination score for ranking anomalies.
 * Score = severityWeight * |zScore|
 * If zScore is not available, defaults to 1.0
 */
function calculateCombinationScore(finding: RawFinding): number {
  const severity = getFindingSeverity(finding);
  const weight = SEVERITY_WEIGHT[severity] || 1;
  const zScore = finding.zScore ?? 1.0;
  return weight * Math.abs(zScore);
}

/**
 * Sort findings by combination score (descending) and limit to top N per campaign.
 * Returns two arrays: [llmFindings, pendingFindings]
 */
function selectTopFindingsPerCampaign(
  findings: RawFinding[],
  topN: number = TOP_ANOMALIES_PER_CAMPAIGN
): { llmFindings: RawFinding[]; pendingFindings: RawFinding[] } {
  // Sort all findings by combination score descending
  const sorted = [...findings].sort((a, b) => calculateCombinationScore(b) - calculateCombinationScore(a));

  const llmFindings: RawFinding[] = [];
  const pendingFindings: RawFinding[] = [];
  const campaignCounts = new Map<string, number>();

  for (const finding of sorted) {
    const currentCount = campaignCounts.get(finding.campaignId) || 0;
    if (currentCount < topN) {
      llmFindings.push(finding);
      campaignCounts.set(finding.campaignId, currentCount + 1);
    } else {
      pendingFindings.push(finding);
    }
  }

  return { llmFindings, pendingFindings };
}

/**
 * Deduplicate findings by (campaignId, date, type, metric).
 * Collapses duplicate keys into a single representative with callCount.
 */
function deduplicateFindings(findings: RawFinding[]): RawFinding[] {
  const groups = new Map<string, RawFinding[]>();

  for (const finding of findings) {
    const key = `${finding.campaignId}|${finding.date}|${finding.type}|${finding.metric}`;
    const existing = groups.get(key) || [];
    existing.push(finding);
    groups.set(key, existing);
  }

  const unique: RawFinding[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      unique.push(group[0]);
    } else {
      const representative: RawFinding = {
        ...group[0],
        callCount: group.length,
      };
      unique.push(representative);
    }
  }

  return unique;
}

function createFallbackAnomaly(finding: RawFinding): ValidatedAnomaly {
  return {
    id: finding.id,
    campaignId: finding.campaignId,
    date: finding.date,
    type: finding.type,
    severity: getFindingSeverity(finding),
    title: DEFAULT_TITLES[finding.type],
    insight: `Detected ${finding.type.toLowerCase().replace(/_/g, ' ')} anomaly. Value: ${finding.value}, Baseline: ${finding.baseline}`,
    suggestedAction: 'Review campaign performance and take corrective action if needed.',
    confidence: 0.7,
    metadata: {
      metric: finding.metric,
      value: finding.value,
      baseline: finding.baseline,
      zScore: finding.zScore,
      regimeId: finding.regime.id,
    },
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callAnthropicWithRetry(
  client: Anthropic,
  findings: RawFinding[],
  maxRetries: number = LLM_MAX_RETRIES
): Promise<{ anomalies: ValidatedAnomaly[]; filtered: { id: string; reason: string }[]; usage: { inputTokens: number; outputTokens: number } }> {
  let lastError: Error | undefined;
  let backoffMs = 1000;
  logger.info(`Calling Anthropic with ${findings.length} findings, maxRetries=${maxRetries}, model=${LLM_MODEL_VALIDATION}, maxTokens=${LLM_MAX_TOKENS}`);
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: LLM_MODEL_VALIDATION,
        max_tokens: LLM_MAX_TOKENS,
        system: ANOMALY_VALIDATION_PROMPT,
        messages: [
          {
            role: 'user',
            content: JSON.stringify({ findings }),
          },
        ],
      });

      // Parse response
      logger.info(`Anthropic response received. Usage: inputTokens=${response.usage?.input_tokens}, outputTokens=${response.usage?.output_tokens}`);
      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new LLMResponseParseError('Anthropic response had no text content');
      }

      const rawText = textContent.text;
      logger.info('Raw Anthropic response text (first 500 chars):', rawText.slice(0, 500));

      const jsonText = extractJSON(rawText);
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(jsonText);
      } catch (parseError) {
        logger.error('Failed to parse Anthropic response as JSON. Extracted text:', jsonText.slice(0, 500));
        logger.error("Reason for parse failure:", parseError instanceof Error ? parseError.message : String(parseError));
        logger.error("Reason for stop:", response.stop_reason);
        throw new LLMResponseParseError(
          `Anthropic response JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          { cause: parseError }
        );
      }

      return {
        anomalies: (parsed.anomalies || []) as ValidatedAnomaly[],
        filtered: (parsed.filtered || []) as { id: string; reason: string }[],
        usage: {
          inputTokens: response.usage?.input_tokens || 0,
          outputTokens: response.usage?.output_tokens || 0,
        },
      };
    } catch (error) {
      lastError = error as Error;

      // Check for rate limiting
      const status = (error as Error & { status?: number }).status;
      if (status === 429) {
        await sleep(backoffMs);
        backoffMs *= 2; // Exponential backoff
        continue;
      }

      if (status === 408 || status === 504 || status === 524) {
        lastError = new LLMError(
          `Anthropic request timed out: ${(error as Error).message ?? ''}`.trim(),
          { cause: error, code: 'LLM_TIMEOUT', statusCode: 504 }
        );
      } else {
        lastError = error as Error;
      }

      // For other errors, retry with backoff
      if (attempt < maxRetries - 1) {
        await sleep(backoffMs);
        backoffMs *= 2;
      }
    }
  }

  // All retries failed, log and throw so the caller can fallback
  const finalError = lastError || new LLMError('LLM validation failed after retries', { retryable: false });
  logger.error('LLM validation failed after max retries', finalError.message);
  throw new LLMError('LLM validation failed after retries', {
    cause: finalError,
    retryable: false,
  });
}

export async function runLLMValidationStage(
  findings: RawFinding[]
): Promise<LLMValidationResult> {
  // Handle empty findings
  if (findings.length === 0) {
    return {
      anomalies: [],
      filtered: { count: 0, reasons: [] },
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new LLMConfigError('ANTHROPIC_API_KEY environment variable is not set');
  }
  const client = new Anthropic({ apiKey });

  // Deduplicate findings before triage to reduce LLM calls
  const deduplicatedFindings = deduplicateFindings(findings);
  const duplicatesRemoved = findings.length - deduplicatedFindings.length;
  if (duplicatesRemoved > 0) {
    logger.info(
      `Deduplicated ${duplicatesRemoved} duplicate findings. ${deduplicatedFindings.length} unique findings remain.`
    );
  }

  // Select top 3 anomalies per campaign by combination score
  const { llmFindings, pendingFindings } = selectTopFindingsPerCampaign(
    deduplicatedFindings,
    TOP_ANOMALIES_PER_CAMPAIGN
  );

  logger.info(
    `Top ${TOP_ANOMALIES_PER_CAMPAIGN} per campaign: ${llmFindings.length} findings sent to LLM, ${pendingFindings.length} marked as pending_insight.`
  );

  // Create fallback anomalies for pending findings with pending_insight status
  const pendingAnomalies: ValidatedAnomaly[] = pendingFindings.map(f => {
    const anomaly = createFallbackAnomaly(f);
    anomaly.title = `[PENDING] ${anomaly.title}`;
    anomaly.insight = `${anomaly.insight} (Deep insight pending. Click "Generate Insight" for detailed analysis using ${LLM_MODEL_DEEP_INSIGHT}.)`;
    return anomaly;
  });

  const allAnomalies: ValidatedAnomaly[] = [...pendingAnomalies];
  const allFilteredReasons: string[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let filteredCount = 0;

  // Process top findings in batches via LLM (Haiku, 400 tokens)
  for (let i = 0; i < llmFindings.length; i += LLM_BATCH_SIZE) {
    const batch = llmFindings.slice(i, i + LLM_BATCH_SIZE);
    const batchIds = new Set(batch.map(f => f.id));

    try {
      const result = await callAnthropicWithRetry(client, batch);

      // Add LLM-enriched anomalies (merge with original finding)
      for (const anomaly of result.anomalies) {
        if (batchIds.has(anomaly.id)) {
          const originalFinding = batch.find(f => f.id === anomaly.id);
          if (originalFinding) {
            const merged: ValidatedAnomaly = {
              id: originalFinding.id,
              campaignId: originalFinding.campaignId,
              date: originalFinding.date,
              type: originalFinding.type,
              severity: getFindingSeverity(originalFinding),
              title: anomaly.title,
              insight: anomaly.insight,
              suggestedAction: anomaly.suggestedAction,
              confidence: anomaly.confidence,
              metadata: anomaly.metadata,
            };
            allAnomalies.push(merged);
          }
          batchIds.delete(anomaly.id);
        }
      }

      // For any findings the LLM filtered, create fallbacks but keep them
      for (const filteredItem of result.filtered) {
        if (batchIds.has(filteredItem.id)) {
          const finding = batch.find(f => f.id === filteredItem.id);
          if (finding) {
            const fallback = createFallbackAnomaly(finding);
            fallback.insight += ` (LLM note: ${filteredItem.reason})`;
            allAnomalies.push(fallback);
            allFilteredReasons.push(filteredItem.reason);
            batchIds.delete(filteredItem.id);
          }
        }
      }

      // Defensive: any IDs still unaccounted for get a fallback
      for (const missingId of batchIds) {
        const finding = batch.find(f => f.id === missingId);
        if (finding) {
          logger.info(`Finding ${missingId} was missing from LLM response; using fallback.`);
          allAnomalies.push(createFallbackAnomaly(finding));
        }
      }

      filteredCount += result.filtered.length;
      totalInputTokens += result.usage.inputTokens;
      totalOutputTokens += result.usage.outputTokens;
    } catch (error) {
      logger.error(
        `LLM validation failed for batch starting at index ${i}, size ${batch.length}. Error:`,
        error instanceof Error ? error.message : String(error)
      );
      // Fallback for the entire batch
      const fallbackAnomalies = batch.map(f => createFallbackAnomaly(f));
      allAnomalies.push(...fallbackAnomalies);
    }
  }

  return {
    anomalies: allAnomalies,
    filtered: {
      count: filteredCount,
      reasons: allFilteredReasons,
    },
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
  };
}
