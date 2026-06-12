import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { Claim, EnrichedSource, ExportFormat, ExportOptions, Run } from "./types";

async function readJsonl<T>(path: string): Promise<T[]> {
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function sourceUrlForClaim(claim: Claim, sources: EnrichedSource[]): string {
  const source = sources.find((s) => claim.sourceIds.includes(s.id));
  return source?.url ?? "";
}

export async function exportRun({ runDir, format, outPath }: ExportOptions): Promise<string> {
  const run = JSON.parse(await readFile(join(runDir, "run.json"), "utf8")) as Run;
  const sources = await readJsonl<EnrichedSource>(join(runDir, "source-ledger.jsonl"));
  const claims = await readJsonl<Claim>(join(runDir, "claim-ledger.jsonl"));

  const destination = outPath ?? join(runDir, `export.${format}`);

  if (format === "json") {
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

  if (format === "csv") {
    const header = ["claim_id", "claim", "source_ids", "confidence", "freshness", "url"];
    const rows = claims.map((claim) => [
      claim.id,
      claim.claim,
      claim.sourceIds.join(";"),
      claim.confidence,
      claim.freshness,
      sourceUrlForClaim(claim, sources),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsvField).join(","))
      .join("\n");
    await writeFile(destination, `${csv}\n`);
    return destination;
  }

  throw new Error(`Unsupported export format: ${format}`);
}

export function supportedExportFormats(): ExportFormat[] {
  return ["json", "csv"];
}
