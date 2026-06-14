import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  Claim,
  EnrichedSource,
  ExportFormat,
  ExportOptions,
  ResearchPlan,
  Run,
  VerificationReport,
} from './types';

async function readJsonl<T>(path: string): Promise<T[]> {
  const text = await readFile(path, 'utf8');
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    const text = await readFile(path, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sourceUrlForClaim(claim: Claim, sources: EnrichedSource[]): string {
  const source = sources.find((s) => claim.sourceIds.includes(s.id));
  return source?.url ?? '';
}

function sourceTitleForClaim(claim: Claim, sources: EnrichedSource[]): string {
  const source = sources.find((s) => claim.sourceIds.includes(s.id));
  return source?.title ?? '';
}

function scoreDistribution(sources: EnrichedSource[]): Record<string, number> {
  const dist: Record<string, number> = { '1-2': 0, '3': 0, '4-5': 0 };
  for (const source of sources) {
    const weighted =
      (source.scores.relevance ?? 0) * 0.35 +
      (source.scores.authority ?? 0) * 0.25 +
      (source.scores.freshness ?? 0) * 0.2 +
      (source.scores.diversity ?? 0) * 0.1 +
      (source.scores.extractionValue ?? 0) * 0.1;
    if (weighted < 2.5) dist['1-2'] += 1;
    else if (weighted < 3.5) dist['3'] += 1;
    else dist['4-5'] += 1;
  }
  return dist;
}

function sourceClassDistribution(sources: EnrichedSource[]): Record<string, number> {
  return sources.reduce<Record<string, number>>((acc, source) => {
    const key = source.sourceClass ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function renderSvgGraph({
  run,
  sources,
  claims,
}: {
  run: Run;
  sources: EnrichedSource[];
  claims: Claim[];
}): string {
  const width = 900;
  const rowHeight = 70;
  const topMargin = 90;
  const bottomMargin = 60;
  const height = Math.max(
    420,
    topMargin + Math.max(sources.length, claims.length) * rowHeight + bottomMargin
  );

  const sourceX = 140;
  const claimX = width - 140;

  const sourceNodes = sources.map((source, i) => ({
    ...source,
    x: sourceX,
    y: topMargin + i * rowHeight + rowHeight / 2,
  }));
  const claimNodes = claims.map((claim, i) => ({
    ...claim,
    x: claimX,
    y: topMargin + i * rowHeight + rowHeight / 2,
  }));

  const sourceById = new Map(sourceNodes.map((s) => [s.id, s]));
  const claimById = new Map(claimNodes.map((c) => [c.id, c]));

  const edges = claims.flatMap((claim) =>
    claim.sourceIds
      .map((sid) => sourceById.get(sid))
      .filter((s): s is (typeof sourceNodes)[number] => s !== undefined)
      .map((source) => {
        const c = claimById.get(claim.id);
        if (!c) return null;
        return { source, claim: c };
      })
      .filter(
        (e): e is { source: (typeof sourceNodes)[number]; claim: (typeof claimNodes)[number] } =>
          e !== null
      )
  );

  const sourceColor = (s: EnrichedSource) => (s.decision === 'accepted' ? '#22c55e' : '#ef4444');
  const claimColor = (c: Claim) => {
    if (c.confidence === 'high') return '#22c55e';
    if (c.confidence === 'medium') return '#f59e0b';
    return '#ef4444';
  };

  const edgeLines = edges
    .map(
      (e) =>
        `<line x1="${e.source.x + 70}" y1="${e.source.y}" x2="${e.claim.x - 70}" y2="${e.claim.y}" stroke="#94a3b8" stroke-width="1.5" opacity="0.45" />`
    )
    .join('');

  const sourceRects = sourceNodes
    .map(
      (s) => `
        <g transform="translate(${s.x - 80}, ${s.y - 22})">
          <rect width="160" height="44" rx="6" fill="${sourceColor(s)}15" stroke="${sourceColor(s)}" stroke-width="2" />
          <text x="80" y="18" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a">${escapeHtml(truncate(s.title, 24))}</text>
          <text x="80" y="34" text-anchor="middle" font-size="10" fill="#64748b">${escapeHtml(s.sourceClass)} · ${escapeHtml(s.id.slice(0, 8))}</text>
        </g>
      `
    )
    .join('');

  const claimRects = claimNodes
    .map(
      (c) => `
        <g transform="translate(${c.x - 80}, ${c.y - 22})">
          <rect width="160" height="44" rx="6" fill="${claimColor(c)}15" stroke="${claimColor(c)}" stroke-width="2" />
          <text x="80" y="18" text-anchor="middle" font-size="11" font-weight="600" fill="#0f172a">${escapeHtml(truncate(c.claim, 26))}</text>
          <text x="80" y="34" text-anchor="middle" font-size="10" fill="#64748b">${c.confidence} · ${escapeHtml(c.id.slice(0, 8))}</text>
        </g>
      `
    )
    .join('');

  const accepted = sources.filter((s) => s.decision === 'accepted').length;
  const rejected = sources.filter((s) => s.decision === 'rejected').length;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="system-ui, -apple-system, sans-serif">
  <rect width="${width}" height="${height}" fill="#f8fafc" />
  <text x="${width / 2}" y="36" text-anchor="middle" font-size="20" font-weight="700" fill="#0f172a">Source ↔ Claim Graph</text>
  <text x="${width / 2}" y="58" text-anchor="middle" font-size="12" fill="#64748b">${escapeHtml(run.objective)}</text>
  <text x="${width / 2}" y="76" text-anchor="middle" font-size="12" fill="#64748b">${sources.length} sources (${accepted} accepted, ${rejected} rejected) · ${claims.length} claims</text>

  <text x="${sourceX}" y="${topMargin - 20}" text-anchor="middle" font-size="14" font-weight="700" fill="#334155">Sources</text>
  <text x="${claimX}" y="${topMargin - 20}" text-anchor="middle" font-size="14" font-weight="700" fill="#334155">Claims</text>

  ${edgeLines}
  ${sourceRects}
  ${claimRects}

  <g transform="translate(20, ${height - 45})">
    <rect x="0" y="0" width="12" height="12" rx="3" fill="#22c55e" />
    <text x="18" y="11" font-size="11" fill="#334155">Accepted source</text>
    <rect x="130" y="0" width="12" height="12" rx="3" fill="#ef4444" />
    <text x="148" y="11" font-size="11" fill="#334155">Rejected source</text>
    <rect x="260" y="0" width="12" height="12" rx="3" fill="#f59e0b" />
    <text x="278" y="11" font-size="11" fill="#334155">Medium confidence</text>
    <rect x="410" y="0" width="12" height="12" rx="3" fill="#94a3b8" />
    <text x="428" y="11" font-size="11" fill="#334155">Edge = claim uses source</text>
  </g>
</svg>`;
}

function svgBarChart(
  data: Record<string, number>,
  options: { width?: number; height?: number; color?: string } = {}
): string {
  const { width = 300, height = 120, color = '#2563eb' } = options;
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const barWidth = width / entries.length - 10;
  const bars = entries
    .map(([label, value], index) => {
      const x = 10 + index * (barWidth + 10);
      const barHeight = (value / max) * (height - 40);
      const y = height - 30 - barHeight;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="3" />
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="12" fill="#334155">${value}</text>
        <text x="${x + barWidth / 2}" y="${height - 12}" text-anchor="middle" font-size="10" fill="#64748b">${escapeHtml(label)}</text>
      `;
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bars}</svg>`;
}

function renderHtmlSynthesis({
  run,
  plan,
  sources,
  claims,
  verification,
}: {
  run: Run;
  plan?: ResearchPlan;
  sources: EnrichedSource[];
  claims: Claim[];
  verification?: VerificationReport;
}): string {
  const acceptedSources = sources.filter((s) => s.decision === 'accepted');
  const rejectedSources = sources.filter((s) => s.decision === 'rejected');
  const scoreDist = scoreDistribution(sources);
  const classDist = sourceClassDistribution(sources);

  const sourceRows = sources
    .map(
      (source) => `
    <tr class="${source.decision}">
      <td><span class="badge ${source.decision}">${source.decision}</span></td>
      <td>${escapeHtml(source.title)}</td>
      <td><a href="${escapeHtml(source.url)}" target="_blank">${escapeHtml(source.url)}</a></td>
      <td>${source.sourceClass}</td>
      <td>${source.publishedAt}</td>
      <td>${source.scores.relevance ?? 0}</td>
      <td>${source.scores.authority ?? 0}</td>
      <td>${source.scores.freshness ?? 0}</td>
    </tr>
  `
    )
    .join('');

  const claimRows = claims
    .map(
      (claim) => `
    <tr>
      <td>${escapeHtml(claim.id)}</td>
      <td>${escapeHtml(claim.claim)}</td>
      <td><span class="badge confidence-${claim.confidence}">${claim.confidence}</span></td>
      <td><span class="badge freshness-${claim.freshness}">${claim.freshness}</span></td>
      <td>${claim.sourceIds.join(', ')}</td>
      <td><a href="${escapeHtml(sourceUrlForClaim(claim, sources))}" target="_blank">${escapeHtml(sourceTitleForClaim(claim, sources))}</a></td>
    </tr>
  `
    )
    .join('');

  const verificationCards = verification
    ? `
      <div class="cards">
        <div class="card"><h3>Status</h3><p class="big ${verification.status}">${verification.status}</p></div>
        <div class="card"><h3>Accepted</h3><p class="big">${verification.acceptedSources}</p></div>
        <div class="card"><h3>Rejected</h3><p class="big">${verification.rejectedSources}</p></div>
        <div class="card"><h3>Claims</h3><p class="big">${claims.length}</p></div>
      </div>
    `
    : '';

  const cost = run.usageMetrics
    ? `<p><strong>Estimated cost:</strong> $${run.usageMetrics.estimatedCostUsd?.toFixed(4) ?? '0.0000'} | <strong>Actual cost:</strong> $${run.usageMetrics.actualCostUsd?.toFixed(4) ?? '0.0000'}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Synthesis: ${escapeHtml(run.objective)}</title>
  <style>
    :root { --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; --border: #e2e8f0; --accepted: #22c55e; --rejected: #ef4444; --high: #22c55e; --medium: #f59e0b; --low: #ef4444; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); max-width: 1200px; margin: 0 auto; padding: 2rem; line-height: 1.5; }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.25rem; margin-top: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    .meta { color: var(--muted); margin-bottom: 1rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem; text-align: center; }
    .card h3 { margin: 0; font-size: 0.875rem; color: var(--muted); }
    .card .big { font-size: 1.75rem; font-weight: 700; margin: 0.5rem 0 0; }
    .passed { color: var(--accepted); } .failed { color: var(--rejected); }
    table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); border-radius: 0.5rem; overflow: hidden; margin-top: 1rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: #f1f5f9; font-weight: 600; }
    tr:last-child td { border-bottom: none; }
    tr.accepted td { background: rgba(34,197,94,0.04); }
    tr.rejected td { background: rgba(239,68,68,0.04); }
    .badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge.accepted { background: #dcfce7; color: #166534; }
    .badge.rejected { background: #fee2e2; color: #991b1b; }
    .badge.confidence-high { background: #dcfce7; color: #166534; }
    .badge.confidence-medium { background: #fef3c7; color: #92400e; }
    .badge.confidence-low { background: #fee2e2; color: #991b1b; }
    .badge.freshness-current { background: #dcfce7; color: #166534; }
    .badge.freshness-stale { background: #fef3c7; color: #92400e; }
    .badge.freshness-unknown { background: #f1f5f9; color: #475569; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin: 1rem 0; }
    .chart { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem; }
    .chart h3 { margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--muted); }
  </style>
</head>
<body>
  <h1>${escapeHtml(run.objective)}</h1>
  <p class="meta">Run ID: <code>${escapeHtml(run.runId)}</code> · Profile: <strong>${run.executionProfile}</strong> · Status: <strong>${run.status}</strong> · ${escapeHtml(run.createdAt)}</p>
  ${plan ? `<p class="meta">Search depth: ${plan.searchDepth} · Query families: ${plan.queryFamilies.map(escapeHtml).join(', ')}</p>` : ''}
  ${cost}
  ${verificationCards}

  <h2>Source Quality</h2>
  <div class="charts">
    <div class="chart"><h3>Weighted Score Distribution</h3>${svgBarChart(scoreDist)}</div>
    <div class="chart"><h3>Source Class Distribution</h3>${svgBarChart(classDist, { color: '#7c3aed' })}</div>
  </div>

  <h2>Sources (${acceptedSources.length} accepted, ${rejectedSources.length} rejected)</h2>
  <table>
    <thead>
      <tr>
        <th>Decision</th>
        <th>Title</th>
        <th>URL</th>
        <th>Class</th>
        <th>Published</th>
        <th>Relevance</th>
        <th>Authority</th>
        <th>Freshness</th>
      </tr>
    </thead>
    <tbody>${sourceRows}</tbody>
  </table>

  <h2>Claims (${claims.length})</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Claim</th>
        <th>Confidence</th>
        <th>Freshness</th>
        <th>Sources</th>
        <th>Linked Source</th>
      </tr>
    </thead>
    <tbody>${claimRows}</tbody>
  </table>
</body>
</html>`;
}

export async function exportRun({ runDir, format, outPath }: ExportOptions): Promise<string> {
  const run = JSON.parse(await readFile(join(runDir, 'run.json'), 'utf8')) as Run;
  const sources = await readJsonl<EnrichedSource>(join(runDir, 'source-ledger.jsonl'));
  const claims = await readJsonl<Claim>(join(runDir, 'claim-ledger.jsonl'));

  const destination = outPath ?? join(runDir, `export.${format}`);

  if (format === 'json') {
    const payload = {
      runId: run.runId,
      objective: run.objective,
      executionProfile: run.executionProfile,
      status: run.status,
      createdAt: run.createdAt,
      usageMetrics: run.usageMetrics,
      sources,
      claims,
    };
    await writeFile(destination, `${JSON.stringify(payload, null, 2)}\n`);
    return destination;
  }

  if (format === 'csv') {
    const header = ['claim_id', 'claim', 'source_ids', 'confidence', 'freshness', 'url'];
    const rows = claims.map((claim) => [
      claim.id,
      claim.claim,
      claim.sourceIds.join(';'),
      claim.confidence,
      claim.freshness,
      sourceUrlForClaim(claim, sources),
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\n');
    await writeFile(destination, `${csv}\n`);
    return destination;
  }

  if (format === 'html') {
    const plan = await readJsonFile<ResearchPlan>(join(runDir, 'research-plan.json'));
    const verification = await readJsonFile<VerificationReport>(
      join(runDir, 'verification-report.json')
    );
    const html = renderHtmlSynthesis({ run, plan, sources, claims, verification });
    await writeFile(destination, html);
    return destination;
  }

  if (format === 'svg') {
    const svg = renderSvgGraph({ run, sources, claims });
    await writeFile(destination, svg);
    return destination;
  }

  throw new Error(`Unsupported export format: ${format}`);
}

export function supportedExportFormats(): ExportFormat[] {
  return ['json', 'csv', 'html', 'svg'];
}
