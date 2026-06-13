import { createInterface, type Interface } from "node:readline/promises";

import { getGlobalConfigPath, writeConfig, type KaswConfig, type ProviderConfig } from "./config";

export interface InitOptions {
  nonInteractive?: boolean;
  global?: boolean;
  workDir?: string;
}

interface ProviderPrompt {
  name: string;
  label: string;
  credentialType: "apiKey" | "token";
  envVar: string;
}

const PROVIDERS: ProviderPrompt[] = [
  { name: "serper", label: "Serper.dev (Google Search)", credentialType: "apiKey", envVar: "SERPER_API_KEY" },
  { name: "tavily", label: "Tavily", credentialType: "apiKey", envVar: "TAVILY_API_KEY" },
  { name: "brave", label: "Brave Search", credentialType: "apiKey", envVar: "BRAVE_API_KEY" },
  { name: "github", label: "GitHub", credentialType: "token", envVar: "GITHUB_TOKEN" },
];

async function prompt(question: string, reader?: Interface): Promise<string> {
  if (!reader) {
    return "";
  }
  const answer = await reader.question(question);
  return answer.trim();
}

async function promptSecret(question: string, reader?: Interface): Promise<string> {
  if (!reader) {
    return "";
  }
  const stdin = process.stdin;
  const stdout = process.stdout;
  stdout.write(question);

  // Disable echo for secret input
  stdin.setRawMode?.(true);
  const chunks: string[] = [];
  for await (const chunk of stdin) {
    const text = chunk.toString();
    for (const char of text) {
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode?.(false);
        stdout.write("\n");
        return chunks.join("").trim();
      }
      if (char === "\u0003") {
        stdin.setRawMode?.(false);
        process.exit(1);
      }
      if (char === "\u007f") {
        chunks.pop();
        stdout.write("\b \b");
      } else {
        chunks.push(char);
        stdout.write("*");
      }
    }
  }
  return chunks.join("").trim();
}

export async function runInit(options: InitOptions = {}): Promise<{ configPath: string; wrote: string[] }> {
  const wrote: string[] = [];
  const config: KaswConfig = {
    providers: {},
    defaults: {
      provider: "mock",
      depth: "standard",
      profile: "fixture",
    },
  };

  let reader: Interface | undefined;
  if (!options.nonInteractive && process.stdin.isTTY) {
    reader = createInterface({ input: process.stdin, output: process.stdout });
  }

  try {
    for (const provider of PROVIDERS) {
      const envValue = process.env[provider.envVar];
      if (envValue) {
        config.providers[provider.name] = {
          [provider.credentialType]: envValue,
        };
        wrote.push(`${provider.name} (from ${provider.envVar})`);
        continue;
      }

      if (options.nonInteractive || !reader) {
        continue;
      }

      const enable = await prompt(`Enable ${provider.label}? (y/N) `, reader);
      if (enable.toLowerCase() !== "y") {
        continue;
      }

      const value = await promptSecret(`Enter ${provider.label} ${provider.credentialType === "apiKey" ? "API key" : "token"}: `, reader);
      if (value) {
        const providerConfig: ProviderConfig = {
          [provider.credentialType]: value,
        };
        config.providers[provider.name] = providerConfig;
        wrote.push(provider.name);
      }
    }

    const configPath = await writeConfig(config, {
      global: options.global ?? true,
      workDir: options.workDir,
    });

    return { configPath, wrote };
  } finally {
    reader?.close();
  }
}

export function getInitInstructions(): string {
  const configPath = getGlobalConfigPath();
  return `Configuration written to ${configPath}.

You can also set API keys via environment variables:
  SERPER_API_KEY, TAVILY_API_KEY, BRAVE_API_KEY, GITHUB_TOKEN

Run a quick demo:
  ./bin/kasw research "AI browser agent repos" --profile fixture

Or run a live search:
  ./bin/kasw research "AI browser agent repos" --profile web-search --provider tavily
`;
}
