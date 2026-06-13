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
  return `<polyline points="${points}" fill="none" stroke="#2563eb" stroke-width="2" />`;
}

function renderProfileSection(profile: string, entries: LeaderboardEntry[]): string {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const precisionValues = sorted.map((e) => e.scores.precision);
  const recallValues = sorted.map((e) => e.scores.recall);
  const f1Values = sorted.map((e) => e.scores.f1);

  const bestF1 = sorted.reduce((best, e) => (e.scores.f1 > best.scores.f1 ? e : best), sorted[0]);

  const rows = sorted
    .map(
      (e) => `
    <tr>
      <td>${escapeHtml(e.timestamp)}</td>
      <td>${escapeHtml(e.runId)}</td>
      <td>${e.scores.precision.toFixed(4)}</td>
      <td>${e.scores.recall.toFixed(4)}</td>
      <td>${e.scores.citationAccuracy.toFixed(4)}</td>
      <td>${e.scores.f1.toFixed(4)}</td>
      <td>${e.scores.passed ? "✅" : "❌"}</td>
    </tr>
  `,
    )
    .join("");

  return `
    <section>
      <h2>${escapeHtml(profile)}</h2>
      <p>Best F1: ${bestF1.scores.f1.toFixed(4)} (run ${escapeHtml(bestF1.runId)})</p>
      <div class="charts">
        <div class="chart">
          <h3>Precision</h3>
          <svg viewBox="0 0 300 100" preserveAspectRatio="none">${trendLine(precisionValues, 300, 100)}</svg>
        </div>
        <div class="chart">
          <h3>Recall</h3>
          <svg viewBox="0 0 300 100" preserveAspectRatio="none">${trendLine(recallValues, 300, 100)}</svg>
        </div>
        <div class="chart">
          <h3>F1</h3>
          <svg viewBox="0 0 300 100" preserveAspectRatio="none">${trendLine(f1Values, 300, 100)}</svg>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Run ID</th>
            <th>Precision</th>
            <th>Recall</th>
            <th>Citation</th>
            <th>F1</th>
            <th>Passed</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
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
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; color: #111; }
    h1 { font-size: 1.75rem; margin-bottom: 1rem; }
    section { margin-bottom: 3rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #ddd; }
    th { font-weight: 600; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .chart { background: #f8fafc; border-radius: 0.5rem; padding: 0.75rem; }
    .chart h3 { margin: 0 0 0.5rem; font-size: 0.875rem; color: #475569; }
    svg { width: 100%; height: 100px; }
  </style>
</head>
<body>
  <h1>KASW Benchmark Leaderboard</h1>
  <p>Generated at ${new Date().toISOString()}</p>
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
