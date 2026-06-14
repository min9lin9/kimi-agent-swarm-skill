import { describe, expect, test } from 'bun:test';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  listConfiguredProviders,
  loadConfig,
  resolveProviderCredential,
  writeConfig,
} from '../src/config';
import type { KaswConfig } from '../src/config';

describe('config', () => {
  test('loadConfig returns defaults when no config files exist', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-config-'));
    const config = await loadConfig(workDir);

    expect(config.defaults.provider).toBe('mock');
    expect(config.defaults.depth).toBe('standard');
    expect(config.defaults.profile).toBe('fixture');
    expect(Object.keys(config.providers).length).toBe(0);
  });

  test('writeConfig and loadConfig roundtrip', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-config-'));
    const written: KaswConfig = {
      providers: {
        tavily: { apiKey: 'test-key' },
        github: { token: 'test-token' },
      },
      defaults: {
        provider: 'tavily',
        depth: 'light',
        profile: 'fixture-youtube-niche',
      },
    };

    await writeConfig(written, { global: false, workDir });
    const loaded = await loadConfig(workDir);

    expect(loaded.providers.tavily?.apiKey).toBe('test-key');
    expect(loaded.providers.github?.token).toBe('test-token');
    expect(loaded.defaults.provider).toBe('tavily');
    expect(loaded.defaults.depth).toBe('light');
    expect(loaded.defaults.profile).toBe('fixture-youtube-niche');
  });

  test('resolveProviderCredential returns env var when set', async () => {
    process.env.TAVILY_API_KEY = 'env-key';
    const config: KaswConfig = { providers: { tavily: { apiKey: 'file-key' } }, defaults: {} };

    const credential = resolveProviderCredential(config, 'tavily');
    expect(credential).toBe('env-key');

    delete process.env.TAVILY_API_KEY;
  });

  test('resolveProviderCredential falls back to config when env var is absent', async () => {
    delete process.env.TAVILY_API_KEY;
    const config: KaswConfig = { providers: { tavily: { apiKey: 'file-key' } }, defaults: {} };

    const credential = resolveProviderCredential(config, 'tavily');
    expect(credential).toBe('file-key');
  });

  test('listConfiguredProviders combines config and env', async () => {
    process.env.BRAVE_API_KEY = 'brave-env';
    const config: KaswConfig = { providers: { tavily: { apiKey: 'tavily-file' } }, defaults: {} };

    const providers = listConfiguredProviders(config);
    expect(providers).toContain('tavily');
    expect(providers).toContain('brave');

    delete process.env.BRAVE_API_KEY;
  });

  test('writeConfig writes config files with restrictive permissions', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-config-perms-'));
    const written: KaswConfig = {
      providers: { tavily: { apiKey: 'secret-key' } },
      defaults: {},
    };

    const localPath = await writeConfig(written, { global: false, workDir });
    const localStat = await stat(localPath);
    expect(localStat.mode & 0o777).toBe(0o600);
  });
});
