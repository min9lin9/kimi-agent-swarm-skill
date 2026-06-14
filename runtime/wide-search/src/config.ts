import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { PROVIDER_REGISTRY } from './providers/registry';
import type { ExecutionProfile, SearchDepth } from './types';

export interface ProviderConfig {
  apiKey?: string;
  token?: string;
}

export interface KaswConfig {
  providers: Record<string, ProviderConfig>;
  defaults: {
    provider?: string;
    depth?: SearchDepth;
    profile?: ExecutionProfile;
  };
}

export const DEFAULT_CONFIG: KaswConfig = {
  providers: {},
  defaults: {
    provider: 'mock',
    depth: 'standard',
    profile: 'fixture',
  },
};

export function getGlobalConfigDir(): string {
  return join(homedir(), '.kasw');
}

export function getGlobalConfigPath(): string {
  return join(getGlobalConfigDir(), 'config.json');
}

export function getLocalConfigPath(workDir: string = process.cwd()): string {
  return join(workDir, '.kasw.json');
}

export async function loadConfig(workDir: string = process.cwd()): Promise<KaswConfig> {
  const globalConfig = await loadConfigFile(getGlobalConfigPath());
  const localConfig = await loadConfigFile(getLocalConfigPath(workDir));

  return mergeConfigs(DEFAULT_CONFIG, globalConfig, localConfig);
}

async function loadConfigFile(path: string): Promise<Partial<KaswConfig>> {
  try {
    const text = await readFile(path, 'utf8');
    const parsed = JSON.parse(text) as Partial<KaswConfig>;
    return normalizeConfig(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function normalizeConfig(config: Partial<KaswConfig>): Partial<KaswConfig> {
  return {
    providers: config.providers ?? {},
    defaults: config.defaults ?? {},
  };
}

function mergeConfigs(
  base: KaswConfig,
  global: Partial<KaswConfig>,
  local: Partial<KaswConfig>
): KaswConfig {
  return {
    providers: {
      ...base.providers,
      ...global.providers,
      ...local.providers,
    },
    defaults: {
      ...base.defaults,
      ...global.defaults,
      ...local.defaults,
    },
  };
}

export async function writeConfig(
  config: KaswConfig,
  options: { global?: boolean; workDir?: string } = {}
): Promise<string> {
  const path = options.global
    ? getGlobalConfigPath()
    : getLocalConfigPath(options.workDir ?? process.cwd());

  if (options.global) {
    await mkdir(getGlobalConfigDir(), { recursive: true });
  }
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  return path;
}

const PROVIDER_ENV_VARS: Record<string, string> = Object.fromEntries(
  PROVIDER_REGISTRY.filter((descriptor) => descriptor.envVar).map((descriptor) => [
    descriptor.name,
    descriptor.envVar!,
  ])
);

export function resolveProviderCredential(
  config: KaswConfig,
  providerName: string
): string | undefined {
  const descriptor = PROVIDER_REGISTRY.find((d) => d.name === providerName);
  const envVar = descriptor?.envVar;
  const envValue = envVar ? process.env[envVar] : undefined;
  if (envValue) {
    return envValue;
  }

  const providerConfig = config.providers[providerName];
  if (providerConfig) {
    return providerConfig.apiKey ?? providerConfig.token;
  }

  return undefined;
}

export function listConfiguredProviders(config: KaswConfig): string[] {
  const fromConfig = Object.keys(config.providers).filter(
    (name) => config.providers[name]?.apiKey || config.providers[name]?.token
  );
  const fromEnv = Object.keys(PROVIDER_ENV_VARS).filter(
    (name) => process.env[PROVIDER_ENV_VARS[name]]
  );
  return [...new Set([...fromConfig, ...fromEnv])];
}
