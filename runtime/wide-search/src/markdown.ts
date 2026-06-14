import type {
  Claim,
  EnrichedSource,
  ExecutionProfile,
  Run,
  VerificationReport,
} from "./types";

function escapeMarkdownCell(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();
}

function escapeMarkdownLinkText(text: string): string {
  return text.replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\n/g, " ");
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function scoreCell(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(2);
}

function formatProfile(profile: ExecutionProfile): string {
  return `\`${profile}\``;
}

function renderAcceptedSourcesTable(sources: EnrichedSource[]): string {
  const accepted = sources.filter((source) => source.decision === "accepted");
  if (accepted.length === 0) {
    return "*No accepted sources.*";
  }

  const header = "| Source | Class | Decision | Relevance | Authority | Freshness | Diversity | Extraction |";
  const separator = "| --- | --- | --- | --- | --- | --- | --- | --- |";

  const rows = accepted.map((source) => {
    const title = escapeMarkdownLinkText(source.title);
    const url = source.url;
    const link = url ? `[${title}](${url})` : title;
    const className = escapeMarkdownCell(source.sourceClass);
    const decision = escapeMarkdownCell(source.decision);
    const scores = source.scores ?? {};

    return `| ${link} | ${className} | ${decision} | ${scoreCell(scores.relevance)} | ${scoreCell(scores.authority)} | ${scoreCell(scores.freshness)} | ${scoreCell(scores.diversity)} | ${scoreCell(scores.extractionValue)} |`;
  });

  return [header, separator, ...rows].join("\n");
}

function renderClaimsTable(claims: Claim[]): string {
  if (claims.length === 0) {
    return "*No claims extracted.*";
  }

  const header = "| Claim | Sources | Confidence | Freshness |";
  const separator = "| --- | --- | --- | --- |";

  const rows = claims.map((claim) => {
    const text = escapeMarkdownCell(claim.claim);
    const sourceIds = escapeMarkdownCell(claim.sourceIds.join(", "));
    const confidence = escapeMarkdownCell(claim.confidence);
    const freshness = escapeMarkdownCell(claim.freshness);

    return `| ${text} | ${sourceIds} | ${confidence} | ${freshness} |`;
  });

  return [header, separator, ...rows].join("\n");
}

function renderVerificationDetails(
  verification: VerificationReport | undefined,
): string {
  if (!verification) {
    return "*No verification report available.*";
  }

  const lines: string[] = [
    `- **Status:** ${verification.status}`,
    `- **Accepted sources:** ${verification.acceptedSources}`,
    `- **Rejected sources:** ${verification.rejectedSources}`,
    `- **Unsupported claims:** ${verification.unsupportedClaims}`,
    `- **Stale claims:** ${verification.staleClaims}`,
    `- **Unknown freshness claims:** ${verification.unknownFreshnessClaims}`,
    `- **Low-confidence claims:** ${verification.lowConfidenceClaims}`,
  ];

  if (verification.failures.length > 0) {
    lines.push("", "### Failures");
    for (const failure of verification.failures) {
      lines.push(`- ${escapeMarkdownCell(failure)}`);
    }
  }

  if (verification.warnings.length > 0) {
    lines.push("", "### Warnings");
    for (const warning of verification.warnings) {
      lines.push(`- ${escapeMarkdownCell(warning)}`);
    }
  }

  if (verification.duplicateClaimGroups.length > 0) {
    lines.push("", "### Duplicate claim groups");
    for (const group of verification.duplicateClaimGroups) {
      lines.push(
        `- **${group.representativeClaimId}** (similar to ${group.claimIds.filter((id) => id !== group.representativeClaimId).join(", ") || "none"}) — ${escapeMarkdownCell(group.similarityReason)}`,
      );
    }
  }

  if (verification.conflictingClaimPairs.length > 0) {
    lines.push("", "### Conflicting claim pairs");
    for (const pair of verification.conflictingClaimPairs) {
      lines.push(
        `- **${pair.claimIdA}** vs **${pair.claimIdB}** — entity \`${escapeMarkdownCell(pair.entity)}\`: ${escapeMarkdownCell(pair.reason)}`,
      );
    }
  }

  if (verification.coverageGaps.length > 0) {
    lines.push("", "### Coverage gaps");
    for (const gap of verification.coverageGaps) {
      lines.push(`- ${escapeMarkdownCell(gap)}`);
    }
  }

  return lines.join("\n");
}

export function renderMarkdownSynthesis(options: {
  run: Run;
  profile: ExecutionProfile;
  sources: EnrichedSource[];
  claims: Claim[];
  verification?: VerificationReport;
}): string {
  const { run, profile, sources, claims, verification } = options;
  const accepted = sources.filter((source) => source.decision === "accepted");
  const rejected = sources.filter((source) => source.decision === "rejected");

  const sections = [
    `# Wide-Search Synthesis: ${escapeMarkdownCell(run.objective)}`,
    "",
    "## Run metadata",
    "",
    `- **Run ID:** \`${run.runId}\``,
    `- **Profile:** ${formatProfile(profile)}`,
    `- **Status:** ${run.status}`,
    `- **Created:** ${formatTimestamp(run.createdAt)}`,
    run.replayedFrom ? `- **Replayed from:** \`${run.replayedFrom}\`` : null,
    run.cached ? "- **Cache:** used" : null,
    "",
    "## Summary",
    "",
    `- **Accepted sources:** ${accepted.length}`,
    `- **Rejected sources:** ${rejected.length}`,
    `- **Total claims:** ${claims.length}`,
    `- **Verification status:** ${verification?.status ?? "unknown"}`,
    "",
    "## Accepted sources",
    "",
    renderAcceptedSourcesTable(sources),
    "",
    "## Claims",
    "",
    renderClaimsTable(claims),
    "",
    "## Verification details",
    "",
    renderVerificationDetails(verification),
    "",
    "## Next steps / human review",
    "",
    "- Review accepted sources for relevance and authority before acting on the findings.",
    "- Check any verification failures or warnings highlighted above.",
    "- Resolve duplicate or conflicting claims by consulting the original sources.",
    "- Rerun with a broader search profile or additional query families if coverage gaps remain.",
    "",
    "## Evidence files",
    "",
    "- `source-ledger.jsonl`",
    "- `claim-ledger.jsonl`",
    verification ? "- `verification-report.json`" : null,
    "- `run.json`",
  ];

  return sections.filter((line) => line !== null).join("\n") + "\n";
}
