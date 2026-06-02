import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function readJsonl(path) {
  try {
    const text = await readFile(path, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function verifyRun({ runDir, minAcceptedSources = 1 } = {}) {
  if (!runDir) {
    throw new Error("verifyRun requires runDir");
  }

  const failures = [];
  const warnings = [];
  const sources = await readJsonl(join(runDir, "source-ledger.jsonl"));
  const claims = await readJsonl(join(runDir, "claim-ledger.jsonl"));

  if (!sources) {
    failures.push("missing source ledger");
  }

  if (!claims) {
    failures.push("missing claim ledger");
  }

  const acceptedSources = sources?.filter((source) => source.decision === "accepted") ?? [];
  const rejectedSources = sources?.filter((source) => source.decision === "rejected") ?? [];

  if (sources && acceptedSources.length < minAcceptedSources) {
    failures.push(`accepted source count ${acceptedSources.length} below minimum ${minAcceptedSources}`);
  }

  const unsupportedClaims = [];
  for (const claim of claims ?? []) {
    if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) {
      unsupportedClaims.push(claim.id ?? claim.claim ?? "unknown claim");
    }
  }

  if (unsupportedClaims.length > 0) {
    failures.push(`unsupported claims: ${unsupportedClaims.join(", ")}`);
  }

  const duplicateSources = sources?.filter((source) => source.reason === "duplicate or low-value source") ?? [];
  if (sources && duplicateSources.length / Math.max(sources.length, 1) > 0.5) {
    warnings.push("duplicate or low-value source ratio is high");
  }

  const report = {
    status: failures.length === 0 ? "passed" : "failed",
    acceptedSources: acceptedSources.length,
    rejectedSources: rejectedSources.length,
    unsupportedClaims: unsupportedClaims.length,
    failures,
    warnings
  };

  await writeFile(join(runDir, "verification-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
