export type RiskLevel = 'low' | 'medium' | 'high';
export type FindingSeverity = 'low' | 'medium' | 'high';
export type FindingCategory =
  | 'bug'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'style';
export type ChecklistStatus = 'missing' | 'ok' | 'unknown';

export interface ReviewResult {
  summary: { overview: string; keyChanges: string[] };
  risk: { level: RiskLevel; rationale: string[] };
  findings: Array<{
    id: string;
    severity: FindingSeverity;
    category: FindingCategory;
    file?: string;
    lineHint?: string;
    message: string;
    recommendation: string;
  }>;
  suggestions: Array<{ title: string; detail: string; example?: string }>;
  checklist: Array<{ item: string; status: ChecklistStatus }>;
  meta: { model: string; promptVersion: string };
}

export interface ReviewRequest {
  title?: string;
  diff: string;
  repoContext?: string;
  language?: string;
  reviewProfile?: 'balanced' | 'strict' | 'security';
}
