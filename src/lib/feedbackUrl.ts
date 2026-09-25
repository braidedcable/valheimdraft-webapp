// Builds a prefilled "new issue" URL on GitHub rather than calling GitHub's
// API directly. This app is a static site with no backend (see
// .github/workflows/deploy.yml — it deploys straight to GitHub Pages), so
// there's nowhere to hold a token that a browser-side API call would need.
// A prefilled link needs no credentials: the user lands on GitHub's own
// form, already signed in there or prompted to sign in, and clicks GitHub's
// own Submit button.
export const GITHUB_REPO = 'braidedcable/valheimdraft-webapp';

export type FeedbackType = 'bug' | 'feature';

export interface FeedbackContext {
  pageUrl: string;
  userAgent: string;
  pieceCount: number;
}

const LABELS: Record<FeedbackType, string> = {
  bug: 'bug',
  feature: 'enhancement',
};

// Diagnostic context is only useful for bug reports — a feature request
// doesn't benefit from the reporter's current piece count or browser string,
// and appending it there would just be noise in the issue body.
export function buildIssueUrl(
  type: FeedbackType,
  title: string,
  description: string,
  context: FeedbackContext
): string {
  const bodyParts = [description.trim()];

  if (type === 'bug') {
    bodyParts.push(
      '',
      '---',
      `Page: ${context.pageUrl}`,
      `Pieces placed: ${context.pieceCount}`,
      `User agent: ${context.userAgent}`
    );
  }

  const params = new URLSearchParams({
    title,
    body: bodyParts.join('\n'),
    labels: LABELS[type],
  });

  return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`;
}
