import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { BenchmarkResult, LeaderboardEntry } from "./types";

export interface ComparisonResult {
  runIds: string[];
  entries: LeaderboardEntry[];
}

export function getLeaderboardDir(): string {
  return join(homedir(), ".kasw");
}

export function getLeaderboardPath(): string {
  return join(getLeaderboardDir(), "leaderboard.jsonl");
}

export async function recordEntry(entry: LeaderboardEntry): Promise<void> {
  const dir = getLeaderboardDir();
  await mkdir(dir, { recursive: true });
  await appendFile(getLeaderboardPath(), `${JSON.stringify(entry)}\n`);
}

export async function getLeaderboard(profile?: string): Promise<LeaderboardEntry[]> {
  try {
    const text = await readFile(getLeaderboardPath(), "utf8");
    const entries = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LeaderboardEntry);

    if (profile) {
      return entries.filter((e) => e.profile === profile);
    }
    return entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function compareRuns(runIds: string[]): Promise<ComparisonResult> {
  const all = await getLeaderboard();
  const entries = all.filter((e) => runIds.includes(e.runId));
  return { runIds, entries };
}

export async function clearLeaderboard(): Promise<void> {
  await writeFile(getLeaderboardPath(), "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString();
}

function shortenRunId(runId: string): string {
  return runId.length > 12 ? `${runId.slice(0, 12)}…` : runId;
}

function trendLine(values: number[], width: number, height: number): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return `<polyline points="${points}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;
}

function barChart(
  data: { label: string; value: number; color?: string }[],
  width: number,
  height: number,
): string {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = width / data.length - 16;
  const bars = data
    .map((d, i) => {
      const x = 8 + i * (barWidth + 16);
      const barHeight = (d.value / max) * (height - 40);
      const y = height - 36 - barHeight;
      const color = d.color ?? "#2563eb";
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="4" />
        <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="12" font-weight="600" fill="#334155">${d.value.toFixed(4)}</text>
        <text x="${x + barWidth / 2}" y="${height - 14}" text-anchor="middle" font-size="11" fill="#64748b">${escapeHtml(d.label)}</text>
      `;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bars}</svg>`;
}

function renderProfileSection(profile: string, entries: LeaderboardEntry[]): string {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const bestByMetric = {
    precision: sorted.reduce((best, e) => (e.scores.precision > best.scores.precision ? e : best), sorted[0]),
    recall: sorted.reduce((best, e) => (e.scores.recall > best.scores.recall ? e : best), sorted[0]),
    f1: sorted.reduce((best, e) => (e.scores.f1 > best.scores.f1 ? e : best), sorted[0]),
  };

  const latest = sorted[sorted.length - 1];
  const passRate = sorted.length > 0
    ? Math.round((sorted.filter((e) => e.scores.passed).length / sorted.length) * 100)
    : 0;

  const rows = sorted
    .map((e) => {
      const isBestF1 = e.runId === bestByMetric.f1.runId;
      return `
        <tr class="${isBestF1 ? "best" : ""}">
          <td>${formatTimestamp(e.timestamp)}</td>
          <td><code>${escapeHtml(shortenRunId(e.runId))}</code></td>
          <td class="num">${e.scores.precision.toFixed(4)}</td>
          <td class="num">${e.scores.recall.toFixed(4)}</td>
          <td class="num">${e.scores.citationAccuracy.toFixed(4)}</td>
          <td class="num">${e.scores.f1.toFixed(4)} ${isBestF1 ? "⭐" : ""}</td>
          <td class="center">${e.scores.passed ? "✅" : "❌"}</td>
          <td class="muted">${e.gitCommit ? escapeHtml(e.gitCommit.slice(0, 8)) : "—"}</td>
        </tr>
      `;
    })
    .join("");

  const barData = [
    { label: "Latest", value: latest.scores.f1, color: "#2563eb" },
    { label: "Best F1", value: bestByMetric.f1.scores.f1, color: "#22c55e" },
    { label: "Best Recall", value: bestByMetric.recall.scores.recall, color: "#a855f7" },
  ];

  return `
    <section>
      <div class="profile-header">
        <h2>${escapeHtml(profile)}</h2>
        <div class="badges">
          <span class="badge">${sorted.length} runs</span>
          <span class="badge ${passRate >= 80 ? "good" : passRate >= 50 ? "warn" : "bad"}">${passRate}% passed</span>
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="label">Best F1</div>
          <div class="value">${bestByMetric.f1.scores.f1.toFixed(4)}</div>
          <div class="sub">${escapeHtml(shortenRunId(bestByMetric.f1.runId))}</div>
        </div>
        <div class="card">
          <div class="label">Best Precision</div>
          <div class="value">${bestByMetric.precision.scores.precision.toFixed(4)}</div>
          <div class="sub">${escapeHtml(shortenRunId(bestByMetric.precision.runId))}</div>
        </div>
        <div class="card">
          <div class="label">Best Recall</div>
          <div class="value">${bestByMetric.recall.scores.recall.toFixed(4)}</div>
          <div class="sub">${escapeHtml(shortenRunId(bestByMetric.recall.runId))}</div>
        </div>
        <div class="card">
          <div class="label">Latest F1</div>
          <div class="value">${latest.scores.f1.toFixed(4)}</div>
          <div class="sub">${formatTimestamp(latest.timestamp)}</div>
        </div>
      </div>

      <div class="charts">
        <div class="chart">
          <h3>F1 Trend</h3>
          <svg viewBox="0 0 400 120" preserveAspectRatio="none">${trendLine(sorted.map((e) => e.scores.f1), 400, 120)}</svg>
        </div>
        <div class="chart">
          <h3>Best Scores</h3>
          ${barChart(barData, 360, 120)}
        </div>
      </div>

      <details open>
        <summary>Run history</summary>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Run ID</th>
              <th class="num">Precision</th>
              <th class="num">Recall</th>
              <th class="num">Citation</th>
              <th class="num">F1</th>
              <th class="center">Passed</th>
              <th class="center">Commit</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </details>
    </section>
  `;
}

export async function generateHtmlReport(
  entries: LeaderboardEntry[],
  outPath: string,
): Promise<string> {
  const byProfile = entries.reduce<Record<string, LeaderboardEntry[]>>((acc, entry) => {
    acc[entry.profile] = acc[entry.profile] ?? [];
    acc[entry.profile].push(entry);
    return acc;
  }, {});

  const summaryCards = [
    { label: "Profiles", value: Object.keys(byProfile).length },
    { label: "Total Runs", value: entries.length },
    { label: "Passed", value: entries.filter((e) => e.scores.passed).length },
    { label: "Failed", value: entries.filter((e) => !e.scores.passed).length },
  ];

  const summaryHtml = summaryCards
    .map(
      (card) => `
        <div class="card summary">
          <div class="label">${escapeHtml(card.label)}</div>
          <div class="value">${card.value}</div>
        </div>
      `,
    )
    .join("");

  const sections = Object.entries(byProfile)
    .map(([profile, profileEntries]) => renderProfileSection(profile, profileEntries))
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KASW Benchmark Leaderboard</title>
  <style>
    :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --muted: #94a3b8; --border: #334155; --accent: #38bdf8; --good: #22c55e; --warn: #f59e0b; --bad: #ef4444; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: var(--bg); color: var(--text); max-width: 1100px; margin: 0 auto; padding: 2rem; line-height: 1.5; }
    h1 { font-size: 2rem; margin: 0 0 0.25rem; }
    .subtitle { color: var(--muted); margin-bottom: 1.5rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem; }
    .card .label { color: var(--muted); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .card .value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
    .card .sub { color: var(--muted); font-size: 0.75rem; margin-top: 0.25rem; }
    section { background: var(--card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.5rem; margin-bottom: 1.5rem; }
    .profile-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
    .profile-header h2 { margin: 0; font-size: 1.25rem; }
    .badges { display: flex; gap: 0.5rem; }
    .badge { display: inline-block; padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: var(--border); color: var(--text); }
    .badge.good { background: rgba(34,197,94,0.15); color: var(--good); }
    .badge.warn { background: rgba(245,158,11,0.15); color: var(--warn); }
    .badge.bad { background: rgba(239,68,68,0.15); color: var(--bad); }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .chart { background: var(--bg); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; }
    .chart h3 { margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--muted); }
    svg { width: 100%; height: 120px; }
    details summary { cursor: pointer; color: var(--accent); font-weight: 600; margin-top: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
    th, td { padding: 0.6rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
    tr:hover td { background: rgba(56,189,248,0.05); }
    tr.best td { background: rgba(34,197,94,0.08); }
    .num { font-variant-numeric: tabular-nums; text-align: right; }
    .center { text-align: center; }
    .muted { color: var(--muted); }
    code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.85em; background: var(--bg); padding: 0.15rem 0.35rem; border-radius: 0.25rem; }
  </style>
</head>
<body>
  <h1>KASW Benchmark Leaderboard</h1>
  <p class="subtitle">Generated at ${formatTimestamp(new Date().toISOString())}</p>

  <div class="summary-grid">
    ${summaryHtml}
  </div>

  ${sections}
</body>
</html>`;

  await writeFile(outPath, html);
  return outPath;
}

export async function getGitCommit(): Promise<string | undefined> {
  try {
    const result = await new Promise<string>((resolve, reject) => {
      import("node:child_process").then(({ exec }) => {
        exec("git rev-parse HEAD", (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout.trim());
        });
      });
    });
    return result;
  } catch {
    return process.env.KASW_GIT_COMMIT;
  }
}
