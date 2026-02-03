import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { createReview } from './api';
import { ReviewRequest, ReviewResult } from './types';
import './styles.css';

const DEFAULT_FORM: ReviewRequest = {
  title: '',
  repoContext: '',
  language: 'typescript',
  reviewProfile: 'balanced',
  diff: '',
};

const TABS = ['Summary', 'Findings', 'Suggestions', 'Checklist'] as const;

type TabKey = (typeof TABS)[number];

export default function App() {
  const [form, setForm] = useState<ReviewRequest>({ ...DEFAULT_FORM });
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('Summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const markdown = useMemo(() => {
    if (!result) return '';
    return reviewToMarkdown(result);
  }, [result]);

  const onChange = (field: keyof ReviewRequest) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setCopyStatus(null);

    if (!form.diff || form.diff.trim().length < 20) {
      setError('Diff must be at least 20 characters.');
      return;
    }

    setLoading(true);
    try {
      const payload: ReviewRequest = {
        ...form,
        title: form.title?.trim() || undefined,
        repoContext: form.repoContext?.trim() || undefined,
        language: form.language || 'typescript',
        reviewProfile: form.reviewProfile || 'balanced',
      };
      const data = await createReview(payload);
      setResult(data);
      setActiveTab('Summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyStatus('Copied to clipboard.');
    } catch {
      setCopyStatus('Copy failed.');
    }
  };

  return (
    <div className="page">
      <header className="header">
        <h1>GitHub PR Analyzer</h1>
        <p>Paste a PR diff and get a structured review.</p>
      </header>

      <main className="layout">
        <section className="panel">
          <form onSubmit={onSubmit} className="form">
            <div className="field">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={onChange('title')}
                placeholder="Optional PR title"
              />
            </div>

            <div className="field">
              <label htmlFor="repoContext">Repo Context</label>
              <input
                id="repoContext"
                type="text"
                value={form.repoContext}
                onChange={onChange('repoContext')}
                placeholder="Optional repo context"
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="language">Language</label>
                <select id="language" value={form.language} onChange={onChange('language')}>
                  <option value="">Auto Detect</option>
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="java">Java</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="profile">Review Profile</label>
                <select
                  id="profile"
                  value={form.reviewProfile}
                  onChange={onChange('reviewProfile')}
                >
                  <option value="balanced">Balanced</option>
                  <option value="strict">Strict</option>
                  <option value="security">Security</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="diff">PR Diff</label>
              <textarea
                id="diff"
                value={form.diff}
                onChange={onChange('diff')}
                rows={16}
                placeholder="Paste the full diff here..."
                required
              />
            </div>

            <button
              type="submit"
              className="primary"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <span className="button-loading">
                  <span className="spinner" aria-hidden="true" />
                  <span>Analyzing...</span>
                </span>
              ) : (
                'Analyze PR'
              )}
            </button>

            {error ? <div className="error">{error}</div> : null}
          </form>
        </section>

        <section className="panel results">
          <div className="results-header">
            <h2>Review Results</h2>
            <div className="results-actions">
              <button type="button" onClick={copyMarkdown} disabled={!result}>
                Copy as Markdown
              </button>
              {copyStatus ? <span className="copy-status">{copyStatus}</span> : null}
            </div>
          </div>

          {!result ? (
            <div className="empty">No review yet. Submit a diff to get started.</div>
          ) : (
            <div>
              <div className="tabs">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={tab === activeTab ? 'tab active' : 'tab'}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="tab-panel">
                {activeTab === 'Summary' && (
                  <div className="section">
                    <h3>Overview</h3>
                    <p>{result.summary.overview}</p>
                    <h3>Key Changes</h3>
                    <ul>
                      {result.summary.keyChanges.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                    <h3>Risk</h3>
                    <div className={`risk risk-${result.risk.level}`}>
                      {result.risk.level.toUpperCase()}
                    </div>
                    <ul>
                      {result.risk.rationale.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                    <div className="meta">Model: {result.meta.model}</div>
                  </div>
                )}

                {activeTab === 'Findings' && (
                  <div className="section">
                    {result.findings.length === 0 ? (
                      <div className="empty">No findings.</div>
                    ) : (
                      result.findings.map((finding) => (
                        <div className="card" key={finding.id}>
                          <div className="card-header">
                            <span className="category">{finding.category}</span>
                            <span className={`pill pill-${finding.severity}`}>
                              {finding.severity}
                            </span>
                          </div>
                          {finding.file ? (
                            <div className="file">
                              {finding.file}
                              {finding.lineHint ? `:${finding.lineHint}` : ''}
                            </div>
                          ) : null}
                          <p>{finding.message}</p>
                          <p className="recommendation">{finding.recommendation}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'Suggestions' && (
                  <div className="section">
                    {result.suggestions.length === 0 ? (
                      <div className="empty">No suggestions.</div>
                    ) : (
                      result.suggestions.map((suggestion, index) => (
                        <div className="card" key={`${suggestion.title}-${index}`}>
                          <h4>{suggestion.title}</h4>
                          <p>{suggestion.detail}</p>
                          {suggestion.example ? (
                            <pre>{suggestion.example}</pre>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'Checklist' && (
                  <div className="section">
                    {result.checklist.length === 0 ? (
                      <div className="empty">No checklist items.</div>
                    ) : (
                      <ul>
                        {result.checklist.map((item, index) => (
                          <li key={`${item.item}-${index}`}>
                            <span className={`pill pill-${item.status}`}>
                              {item.status}
                            </span>
                            {item.item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function reviewToMarkdown(result: ReviewResult): string {
  const lines: string[] = [];
  lines.push('## PR Review Summary');
  lines.push('');
  lines.push(result.summary.overview);
  lines.push('');
  lines.push('**Key Changes**');
  result.summary.keyChanges.forEach((item) => {
    lines.push(`- ${item}`);
  });
  lines.push('');
  lines.push(`**Risk Level:** ${result.risk.level.toUpperCase()}`);
  result.risk.rationale.forEach((item) => {
    lines.push(`- ${item}`);
  });
  lines.push('');

  lines.push('## Findings');
  const grouped = groupFindings(result.findings);
  if (result.findings.length === 0) {
    lines.push('- No findings.');
  } else {
    (['high', 'medium', 'low'] as const).forEach((severity) => {
      const items = grouped[severity];
      if (!items.length) return;
      lines.push(`- **${severity.toUpperCase()}**`);
      items.forEach((finding) => {
        const location = finding.file
          ? ` (${finding.file}${finding.lineHint ? `:${finding.lineHint}` : ''})`
          : '';
        lines.push(`  - ${finding.message}${location}`);
        lines.push(`    - Recommendation: ${finding.recommendation}`);
      });
    });
  }

  lines.push('');
  lines.push('## Suggestions');
  if (result.suggestions.length === 0) {
    lines.push('- None.');
  } else {
    result.suggestions.forEach((suggestion) => {
      lines.push(`- ${suggestion.title}: ${suggestion.detail}`);
      if (suggestion.example) {
        lines.push('');
        lines.push('```');
        lines.push(suggestion.example);
        lines.push('```');
      }
    });
  }

  lines.push('');
  lines.push('## Checklist');
  if (result.checklist.length === 0) {
    lines.push('- None.');
  } else {
    result.checklist.forEach((item) => {
      lines.push(`- [${item.status === 'ok' ? 'x' : ' '}] ${item.item}`);
    });
  }

  return lines.join('\n');
}

function groupFindings(findings: ReviewResult['findings']) {
  return findings.reduce(
    (acc, finding) => {
      acc[finding.severity].push(finding);
      return acc;
    },
    {
      high: [],
      medium: [],
      low: [],
    } as Record<'high' | 'medium' | 'low', ReviewResult['findings']>,
  );
}
