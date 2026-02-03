import {
  BadGatewayException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OpenAIClient } from '../openai/openai.client';
import { ReviewRequestDto } from './review-request.dto';
import {
  ChecklistStatus,
  FindingCategory,
  FindingSeverity,
  ReviewResult,
  RiskLevel,
} from './review-result';

const DEFAULT_MAX_DIFF_LENGTH = 200_000;
const PROMPT_VERSION = 'v1.0.0';

@Injectable()
export class ReviewsService {
  private client: OpenAIClient | null;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    this.client = apiKey ? new OpenAIClient(apiKey, this.model) : null;
  }

  async createReview(dto: ReviewRequestDto): Promise<ReviewResult> {
    if (!this.client) {
      throw new ServiceUnavailableException('OpenAI API key is not configured');
    }

    const MAX_DIFF_LENGTH = parseInt(
      process.env.MAX_DIFF_LENGTH || `${DEFAULT_MAX_DIFF_LENGTH}`,
    );
    if (dto.diff.length > MAX_DIFF_LENGTH) {
      throw new PayloadTooLargeException(
        `Diff exceeds ${MAX_DIFF_LENGTH} characters`,
      );
    }

    const language = dto.language || 'typescript';
    const profile = dto.reviewProfile || 'balanced';

    const systemMessage =
      'You are a senior software engineer performing a PR review. ' +
      'Use only the provided diff and context. ' +
      'Do not invent files, behavior, or requirements. ' +
      'If something is unclear, mark it as unknown or omit it.';

    const developerMessage =
      'Return STRICT JSON only. Do not include markdown or extra text. ' +
      'The JSON must exactly match this TypeScript type:\n' +
      '{\n' +
      '  "summary": { "overview": string, "keyChanges": string[] },\n' +
      '  "risk": { "level": "low"|"medium"|"high", "rationale": string[] },\n' +
      '  "findings": Array<{\n' +
      '    "id": string,\n' +
      '    "severity": "low"|"medium"|"high",\n' +
      '    "category": "bug"|"security"|"performance"|"maintainability"|"style",\n' +
      '    "file"?: string,\n' +
      '    "lineHint"?: string,\n' +
      '    "message": string,\n' +
      '    "recommendation": string\n' +
      '  }>,\n' +
      '  "suggestions": Array<{ "title": string, "detail": string, "example"?: string }>,\n' +
      '  "checklist": Array<{ "item": string, "status": "missing"|"ok"|"unknown" }>,\n' +
      '  "meta": { "model": string, "promptVersion": string }\n' +
      '}\n' +
      `Set meta.promptVersion to "${PROMPT_VERSION}". ` +
      'If there are no findings or suggestions, return empty arrays.';

    const userMessage = [
      `Title: ${dto.title || 'N/A'}`,
      `Repo Context: ${dto.repoContext || 'N/A'}`,
      `Language: ${language}`,
      `Review Profile: ${profile}`,
      'Diff:',
      dto.diff,
    ].join('\n');

    try {
      const response = await this.client.createJsonCompletion({
        system: systemMessage,
        developer: developerMessage,
        user: userMessage,
      });

      const parsed = parseJson(response.content);
      assertReviewResult(parsed);
      parsed.meta.model = response.model;
      parsed.meta.promptVersion = PROMPT_VERSION;
      return parsed;
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw error;
      }
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      console.error('Error creating review:', error);
      throw new BadGatewayException(
        'Upstream model error. Please try again later.',
      );
    }
  }
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new BadGatewayException('Model returned invalid JSON');
  }
}

function assertReviewResult(value: unknown): asserts value is ReviewResult {
  if (!isRecord(value)) {
    throw new BadGatewayException('Model returned invalid JSON shape');
  }

  const summary = value.summary;
  if (!isRecord(summary) || !isString(summary.overview)) {
    throw new BadGatewayException('Invalid summary');
  }
  if (!isStringArray(summary.keyChanges)) {
    throw new BadGatewayException('Invalid summary.keyChanges');
  }

  const risk = value.risk;
  if (
    !isRecord(risk) ||
    !isRiskLevel(risk.level) ||
    !isStringArray(risk.rationale)
  ) {
    throw new BadGatewayException('Invalid risk');
  }

  if (!Array.isArray(value.findings)) {
    throw new BadGatewayException('Invalid findings');
  }
  value.findings.forEach((finding) => {
    if (!isRecord(finding)) {
      throw new BadGatewayException('Invalid finding');
    }
    if (
      !isString(finding.id) ||
      !isFindingSeverity(finding.severity) ||
      !isFindingCategory(finding.category) ||
      !isString(finding.message) ||
      !isString(finding.recommendation)
    ) {
      throw new BadGatewayException('Invalid finding');
    }
    if (finding.file !== undefined && !isString(finding.file)) {
      throw new BadGatewayException('Invalid finding.file');
    }
    if (finding.lineHint !== undefined && !isString(finding.lineHint)) {
      throw new BadGatewayException('Invalid finding.lineHint');
    }
  });

  if (!Array.isArray(value.suggestions)) {
    throw new BadGatewayException('Invalid suggestions');
  }
  value.suggestions.forEach((suggestion) => {
    if (!isRecord(suggestion)) {
      throw new BadGatewayException('Invalid suggestion');
    }
    if (!isString(suggestion.title) || !isString(suggestion.detail)) {
      throw new BadGatewayException('Invalid suggestion');
    }
    if (suggestion.example !== undefined && !isString(suggestion.example)) {
      throw new BadGatewayException('Invalid suggestion.example');
    }
  });

  if (!Array.isArray(value.checklist)) {
    throw new BadGatewayException('Invalid checklist');
  }
  value.checklist.forEach((item) => {
    if (!isRecord(item)) {
      throw new BadGatewayException('Invalid checklist item');
    }
    if (!isString(item.item) || !isChecklistStatus(item.status)) {
      throw new BadGatewayException('Invalid checklist item');
    }
  });

  const meta = value.meta;
  if (!isRecord(meta) || !isString(meta.model) || !isString(meta.promptVersion)) {
    throw new BadGatewayException('Invalid meta');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isFindingSeverity(value: unknown): value is FindingSeverity {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isFindingCategory(value: unknown): value is FindingCategory {
  return (
    value === 'bug' ||
    value === 'security' ||
    value === 'performance' ||
    value === 'maintainability' ||
    value === 'style'
  );
}

function isChecklistStatus(value: unknown): value is ChecklistStatus {
  return value === 'missing' || value === 'ok' || value === 'unknown';
}
