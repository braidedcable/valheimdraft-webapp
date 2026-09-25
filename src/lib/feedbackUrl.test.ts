import { describe, expect, it } from 'vitest';
import { buildIssueUrl, GITHUB_REPO } from './feedbackUrl';

const context = { pageUrl: 'https://example.com/app', userAgent: 'TestAgent/1.0', pieceCount: 3 };

describe('buildIssueUrl', () => {
  it('points at the GitHub repo issues/new endpoint', () => {
    const url = buildIssueUrl('bug', 'Title', 'Description', context);
    expect(url.startsWith(`https://github.com/${GITHUB_REPO}/issues/new?`)).toBe(true);
  });

  it('labels bug reports as bug and feature requests as enhancement', () => {
    const bugUrl = new URL(buildIssueUrl('bug', 'T', 'D', context));
    const featureUrl = new URL(buildIssueUrl('feature', 'T', 'D', context));
    expect(bugUrl.searchParams.get('labels')).toBe('bug');
    expect(featureUrl.searchParams.get('labels')).toBe('enhancement');
  });

  it('carries the title through unescaped', () => {
    const url = new URL(buildIssueUrl('bug', 'Pieces vanish on undo', 'D', context));
    expect(url.searchParams.get('title')).toBe('Pieces vanish on undo');
  });

  it('appends diagnostic context to bug reports only', () => {
    const bugBody = new URL(buildIssueUrl('bug', 'T', 'Steps here', context)).searchParams.get('body')!;
    expect(bugBody).toContain('Steps here');
    expect(bugBody).toContain('Page: https://example.com/app');
    expect(bugBody).toContain('Pieces placed: 3');
    expect(bugBody).toContain('User agent: TestAgent/1.0');

    const featureBody = new URL(buildIssueUrl('feature', 'T', 'Add a thing', context)).searchParams.get(
      'body'
    )!;
    expect(featureBody).toBe('Add a thing');
  });

  it('trims the description', () => {
    const body = new URL(buildIssueUrl('feature', 'T', '  spaced out  ', context)).searchParams.get(
      'body'
    )!;
    expect(body).toBe('spaced out');
  });
});
