import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { loadConfig, resolveProviderCredential } from "../config";
import { createSearchProvider } from "../providers";
import { scoreSource } from "../scorer";
import { verifyRun } from "../verifier";
import type { QueueAdapter } from "./queue-adapter";
import { MemoryQueueAdapter } from "./memory-adapter";
import { RedisQueueAdapter } from "./redis-adapter";
import {
  buildTasksFromPlans,
  splitFixtureTasks,
  splitWebSearchTasks,
} from "./task-splitter";
import type {
  Claim,
  ClaimConfidence,
  ClaimFreshness,
  DistributedJob,
  DistributedRunOptions,
  DistributedTask,
  EnrichedSource,
  ExecutionProfile,
  ResearchPlan,
  Run,
  RunWideSearchOptions,
  RunWideSearchResult,
  SearchDepth,
  Source,
  UsageMetrics,
  WorkerResult,
} from "../types";

function makeRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}`;
}

function claimConfidence(source: EnrichedSource): ClaimConfidence {
  const score = source.scores?.authority ?? 0;
  if (score >= 4.5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function claimFreshness(source: EnrichedSource): ClaimFreshness {
  if (!source.publishedAt || source.publishedAt === "unknown") return "unknown";
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    .toISOString()
    .split("T")[0];
  return source.publishedAt >= oneYearAgo ? "current" : "stale";
}

function renderSynthesis({
  objective,
  profile,
  sources,
  claims,
  verification,
}: {
  objective: string;
  profile: ExecutionProfile;
  sources: EnrichedSource[];
  claims: Claim[];
  verification: { status: string; acceptedSources: number; rejectedSources: number };
}): string {
  const acceptedSources = sources.filter((s) => s.decision === "accepted");
  const acceptedClaims = claims;
  const lines = [
    `# Synthesis: ${objective}`,
    "",
    `**Profile:** ${profile}`,
    `**Accepted sources:** ${acceptedSources.length} | **Rejected sources:** ${sources.length - acceptedSources.length}`,
    `**Accepted claims:** ${acceptedClaims.length}`,
    `**Verification:** ${verification.status}`,
    "",
    "## Accepted sources",
    ...acceptedSources.map((source) => `- [${source.sourceClass}] [${source.title}](${source.url}) (${source.decision})`),
    "",
    "## Claims",
    ...acceptedClaims.map((claim) => `- ${claim.claim} [confidence: ${claim.confidence}, freshness: ${claim.freshness}]`),
    "",
    "## Method notes",
    "This run used distributed execution. Results were aggregated from multiple worker tasks.",
  ];
  return lines.join("\n");
}

function createQueueAdapter(
  options: DistributedRunOptions,
  workDir: string,
): QueueAdapter {
  if (options.queueType === "redis") {
    return new RedisQueueAdapter();
  }
  return new MemoryQueueAdapter({ workDir });
}

async function executeTask(
  task: DistributedTask,
  profile: ExecutionProfile,
  providerName: string,
  searchDepth: SearchDepth,
  metrics: UsageMetrics,
): Promise<WorkerResult> {
  if (profile.startsWith("fixture")) {
    const sourceIds = task.query.split(",").map((id) => id.trim());
    const allSources = await loadFixtureSources(profile);
    const selected = allSources.filter((s) => sourceIds.includes(s.id));
    return { sources: selected, usageMetrics: { ...metrics } };
  }

  const config = await loadConfig();
  const credential = resolveProviderCredential(config, providerName);
  const provider = createSearchProvider(providerName, { credential, metrics });
  const maxResults = Math.ceil(25 / 5); // split results across families
  const sources = await provider.search({
    objective: task.query,
    depth: searchDepth,
    maxResults,
  });
  return { sources, usageMetrics: { ...metrics } };
}

async function loadFixtureSources(profile: ExecutionProfile): Promise<Source[]> {
  const FIXTURE_FILE_MAP: Record<string, string> = {
    fixture: "basic-sources.json",
    "fixture-asset-mgmt": "asset-mgmt-roles.json",
    "fixture-sellside-research": "sellside-research-roles.json",
    "fixture-youtube-niche": "youtube-niche.json",
    "fixture-paul-graham-corpus": "paul-graham-corpus.json",
    "fixture-github-repo-landscape": "github-repo-landscape.json",
    "fixture-market-scan": "market-scan.json",
  };

  const fileName = FIXTURE_FILE_MAP[profile];
  if (!fileName) {
    throw new Error(`No fixture file mapping for profile: ${profile}`);
  }

  const text = await readFile(join(import.meta.dir, "../../fixtures", fileName), "utf8");
  const data = JSON.parse(text) as { sources: Source[] };
  return data.sources;
}

export async function workerLoop(
  adapter: QueueAdapter,
  jobId: string,
  workerId: string,
  profile: ExecutionProfile,
  providerName: string,
  searchDepth: SearchDepth,
  metrics: UsageMetrics,
): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pending = await adapter.getPendingTaskCount(jobId);
    const running = await adapter.getRunningTaskCount(jobId);
    if (pending === 0 && running === 0) {
      return;
    }

    const task = await adapter.claimNextTask(jobId, workerId);
    if (!task) {
      // No task claimed but work may remain; brief backoff.
      await new Promise((resolve) => setTimeout(resolve, 50));
      continue;
    }

    try {
      const result = await executeTask(task, profile, providerName, searchDepth, metrics);
      await adapter.completeTask(task.taskId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await adapter.failTask(task.taskId, message);
    }
  }
}

export async function runDistributedWideSearch({
  objective,
  profile = "fixture",
  providerName,
  searchDepth = "standard",
  workDir = process.cwd(),
  distributed = { enabled: true },
}: RunWideSearchOptions): Promise<RunWideSearchResult> {
  const runId = makeRunId();
  const runDir = join(workDir, ".runs", "wide-search", runId);
  await mkdir(runDir, { recursive: true });

  const effectiveProviderName = profile === "web-search" ? (providerName ?? "mock") : "mock";
  const maxRetries = distributed.maxRetries ?? 3;
  const workers = distributed.workers ?? 4;

  const adapter = createQueueAdapter(distributed, workDir);

  let job: DistributedJob;
  if (distributed.resumeJobId) {
    const loaded = await adapter.getJob(distributed.resumeJobId);
    if (!loaded) {
      throw new Error(`Job not found for resume: ${distributed.resumeJobId}`);
    }
    job = loaded;
  } else {
    const plans = profile.startsWith("fixture")
      ? await splitFixtureTasks(profile, join(import.meta.dir, "../../fixtures"))
      : splitWebSearchTasks(objective ?? "");
    const tasks = buildTasksFromPlans("placeholder", plans, maxRetries);
    job = await adapter.createJob({
      objective: objective ?? "",
      executionProfile: profile,
      providerName: effectiveProviderName,
      searchDepth,
      queueType: distributed.queueType ?? "memory",
      status: "pending",
      tasks: tasks.map((t) => ({ ...t, taskId: `${runId}-${t.taskId}` })),
    });
  }

  job.status = "running";
  await adapter.saveJob(job);

  const workerMetrics: UsageMetrics[] = [];
  const workerPromises: Promise<void>[] = [];
  for (let i = 0; i < workers; i += 1) {
    const metrics: UsageMetrics = { providerCalls: 0, apiCalls: 0 };
    workerMetrics.push(metrics);
    workerPromises.push(
      workerLoop(
        adapter,
        job.jobId,
        `worker-${i + 1}`,
        profile,
        effectiveProviderName,
        searchDepth,
        metrics,
      ),
    );
  }

  await Promise.all(workerPromises);

  const completedJob = await adapter.getJob(job.jobId);
  if (!completedJob) {
    throw new Error("Job disappeared during distributed run");
  }

  const aggregatedSources: Source[] = [];
  for (const task of completedJob.tasks) {
    if (task.status === "completed" && task.result) {
      aggregatedSources.push(...task.result.sources);
    }
  }

  if (aggregatedSources.length === 0) {
    throw new Error("Distributed run produced no accepted sources");
  }

  const sources: EnrichedSource[] = aggregatedSources.map((source) => scoreSource(source));

  const claims: Claim[] = [];
  for (const source of sources.filter((item) => item.decision === "accepted")) {
    for (const claim of source.claims ?? []) {
      claims.push({
        id: `C${String(claims.length + 1).padStart(3, "0")}`,
        claim,
        sourceIds: [source.id],
        confidence: claimConfidence(source),
        freshness: claimFreshness(source),
      });
    }
  }

  const totalMetrics: UsageMetrics = workerMetrics.reduce(
    (acc, m) => ({
      providerCalls: acc.providerCalls + m.providerCalls,
      apiCalls: acc.apiCalls + m.apiCalls,
    }),
    { providerCalls: 0, apiCalls: 0 },
  );

  const run: Run = {
    runId,
    objective: objective ?? "",
    executionProfile: profile,
    status: "completed",
    createdAt: new Date().toISOString(),
    usageMetrics: totalMetrics,
  };

  const researchPlan: ResearchPlan = {
    objective: objective ?? "",
    searchDepth,
    executionProfile: profile,
    queryFamilies: completedJob.tasks.map((t) => t.queryFamily),
    sourceTargets: ["official", "community", "secondary"],
    stopConditions: ["all distributed tasks completed"],
  };

  await writeFile(join(runDir, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  await writeFile(join(runDir, "research-plan.json"), `${JSON.stringify(researchPlan, null, 2)}\n`);
  await writeFile(
    join(runDir, "source-ledger.jsonl"),
    `${sources.map((source) => JSON.stringify(source)).join("\n")}\n`,
  );
  await writeFile(
    join(runDir, "claim-ledger.jsonl"),
    `${claims.map((claim) => JSON.stringify(claim)).join("\n")}\n`,
  );
  await writeFile(join(runDir, "distributed-job.json"), `${JSON.stringify(completedJob, null, 2)}\n`);

  const verification = await verifyRun({ runDir, minAcceptedSources: 1 });
  const synthesis = renderSynthesis({ objective: objective ?? "", profile, sources, claims, verification });
  await writeFile(join(runDir, "synthesis.md"), synthesis);

  return {
    runId,
    runDir,
    verification,
  };
}
