import type { SourceClass } from './types';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function parseRelativeDate(dateText: string): string | undefined {
  const normalized = dateText.toLowerCase().trim();
  const now = new Date();

  const dayMatch = normalized.match(/^(\d+)\s+day(?:s)?\s+ago$/);
  if (dayMatch) {
    const days = Number.parseInt(dayMatch[1], 10);
    const date = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }

  const monthMatch = normalized.match(/^(\d+)\s+month(?:s)?\s+ago$/);
  if (monthMatch) {
    const months = Number.parseInt(monthMatch[1], 10);
    const date = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return date.toISOString().split('T')[0];
  }

  const yearMatch = normalized.match(/^(\d+)\s+year(?:s)?\s+ago$/);
  if (yearMatch) {
    const years = Number.parseInt(yearMatch[1], 10);
    const date = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
    return date.toISOString().split('T')[0];
  }

  return undefined;
}

export function inferSourceClass(url: string): Extract<SourceClass, 'primary' | 'secondary'> {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (
      hostname === 'github.com' ||
      hostname.endsWith('.github.io') ||
      hostname === 'arxiv.org' ||
      hostname.endsWith('.gov') ||
      hostname.endsWith('.edu') ||
      hostname.endsWith('.ac.uk')
    ) {
      return 'primary';
    }
  } catch {
    // invalid URL, fall through to secondary
  }
  return 'secondary';
}

export function parsePublishedAt(dateText?: string): string {
  if (!dateText) return today();

  const trimmed = dateText.trim();

  // ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Relative date
  const relative = parseRelativeDate(trimmed);
  if (relative) return relative;

  // Generic date parse
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return today();
}
