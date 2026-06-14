import { type Interface, createInterface } from 'node:readline/promises';

import { type KaswConfig, type ProviderConfig, getGlobalConfigPath, writeConfig } from './config';
import { PROVIDER_REGISTRY, type ProviderCredentialType } from './providers/registry';

export interface InitOptions {
  nonInteractive?: boolean;
  global?: boolean;
  workDir?: string;
}

interface ProviderPrompt {
  name: string;
  label: string;
  credentialType: ProviderCredentialType;
  envVar: string;
}

const PROVIDERS: ProviderPrompt[] = PROVIDER_REGISTRY.filter(
  (descriptor): descriptor is typeof descriptor & { envVar: string } => Boolean(descriptor.envVar)
).map((descriptor) => ({
  name: descriptor.name,
  label: descriptor.description,
  credentialType: descriptor.credentialType,
  envVar: descriptor.envVar,
}));

async function prompt(question: string, reader?: Interface): Promise<string> {
  if (!reader) {
    return '';
  }
  const answer = await reader.question(question);
  return answer.trim();
}

async function promptSecret(question: string, reader?: Interface): Promise<string> {
  if (!reader) {
    return '';
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
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode?.(false);
        stdout.write('\n');
        return chunks.join('').trim();
      }
      if (char === '\u0003') {
        stdin.setRawMode?.(false);
        process.exit(1);
      }
      if (char === '\u007f') {
        chunks.pop();
        stdout.write('\b \b');
      } else {
        chunks.push(char);
        stdout.write('*');
      }
    }
  }
  return chunks.join('').trim();
}

export async function runInit(
  options: InitOptions = {}
): Promise<{ configPath: string; wrote: string[] }> {
  const wrote: string[] = [];
  const config: KaswConfig = {
    providers: {},
    defaults: {
      provider: 'mock',
      depth: 'standard',
      profile: 'fixture',
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
      if (enable.toLowerCase() !== 'y') {
        continue;
      }

      const value = await promptSecret(
        `Enter ${provider.label} ${provider.credentialType === 'apiKey' ? 'API key' : 'token'}: `,
        reader
      );
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

export function getInitInstructions(configPath: string): string {
  const envVarList = PROVIDERS.map((provider) => provider.envVar).join(', ');
  const scopeHint = configPath.endsWith('.kasw.json')
    ? 'Local configuration written to the current working directory.'
    : 'Global configuration written to your home directory.';
  return `${scopeHint}

Path: ${configPath}

You can also set API keys via environment variables:
  ${envVarList}

Run a quick demo:
  kasw research "AI browser agent repos" --profile fixture

Run a live search:
  kasw research "AI browser agent repos" --profile web-search --provider tavily

Other useful commands:
  kasw benchmark --profile <fixture>
  kasw leaderboard [--profile <fixture>] [--html]
  kasw init --local            # write config to the current working directory
`;
}
