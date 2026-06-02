import { spawn } from "node:child_process";

export async function loadCommandSources({ providerCommand, providerArgs = [], objective } = {}) {
  if (!providerCommand) {
    throw new Error("local-command profile requires providerCommand");
  }

  const output = await runProviderCommand({ providerCommand, providerArgs, objective });
  return parseProviderJsonl(output);
}

function runProviderCommand({ providerCommand, providerArgs, objective }) {
  return new Promise((resolve, reject) => {
    const child = spawn(providerCommand, providerArgs, {
      env: {
        ...process.env,
        WIDE_SEARCH_OBJECTIVE: objective
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`provider command exited ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function parseProviderJsonl(output) {
  const sources = [];
  const errors = [];

  for (const [index, line] of output.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      errors.push(`line ${index + 1} is not valid JSON`);
      continue;
    }

    if (event.type === "source_candidate" && event.source) {
      sources.push(event.source);
      continue;
    }

    if (event.type === "error") {
      errors.push(event.message ?? `provider error on line ${index + 1}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`provider output errors: ${errors.join("; ")}`);
  }

  if (sources.length === 0) {
    throw new Error("provider emitted no source_candidate events");
  }

  return sources;
}
