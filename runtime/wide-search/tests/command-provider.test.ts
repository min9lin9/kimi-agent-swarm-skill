import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadCommandSources } from '../src/command-provider';

function source(id: string): import('../src/types').Source {
  return {
    id,
    url: 'https://example.com',
    title: `Source ${id}`,
    sourceClass: 'primary',
    discoveredBy: 'command-provider-test',
    scores: { relevance: 5, authority: 4, freshness: 5, diversity: 3, extractionValue: 4 },
  };
}

describe('loadCommandSources', () => {
  test('ingests JSONL source_candidate events from a shell command', async () => {
    const providerCommand = 'node';
    const providerArgs = [
      '-e',
      `console.log(JSON.stringify({ type: "source_candidate", source: ${JSON.stringify(
        source('CMD-001')
      )} }));`,
    ];

    const sources = await loadCommandSources({
      providerCommand,
      providerArgs,
      objective: 'test objective',
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe('CMD-001');
    expect(sources[0].discoveredBy).toBe('command-provider-test');
  });

  test('ingests sources from a complete event', async () => {
    const providerCommand = 'node';
    const providerArgs = [
      '-e',
      `console.log(JSON.stringify({ type: "complete", sources: ${JSON.stringify([
        source('COMPLETE-001'),
        source('COMPLETE-002'),
      ])} }));`,
    ];

    const sources = await loadCommandSources({
      providerCommand,
      providerArgs,
      objective: 'complete event test',
    });

    expect(sources).toHaveLength(2);
    expect(sources.map((s) => s.id)).toEqual(['COMPLETE-001', 'COMPLETE-002']);
  });

  test('throws a clear error when the provider command exits non-zero', async () => {
    const providerCommand = 'node';
    const providerArgs = ['-e', "process.stderr.write('provider failed'); process.exit(1);"];

    await expect(
      loadCommandSources({ providerCommand, providerArgs, objective: 'failing test' })
    ).rejects.toThrow('exited 1');

    try {
      await loadCommandSources({ providerCommand, providerArgs, objective: 'failing test' });
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toInclude('provider failed');
        return;
      }
      throw error;
    }
  });

  test('throws when providerCommand is missing', async () => {
    await expect(loadCommandSources({ objective: 'missing command' })).rejects.toThrow(
      'local-command profile requires providerCommand'
    );
  });

  test('times out a provider command that does not exit', async () => {
    await expect(
      loadCommandSources({
        providerCommand: 'node',
        providerArgs: ['-e', 'setInterval(() => {}, 1000);'],
        objective: 'hanging provider',
        timeoutMs: 50,
      })
    ).rejects.toThrow('timed out');
  });

  test('rejects provider output above the configured byte limit', async () => {
    await expect(
      loadCommandSources({
        providerCommand: 'node',
        providerArgs: ['-e', `console.log(${JSON.stringify('x'.repeat(128))});`],
        objective: 'oversized provider',
        maxOutputBytes: 64,
      })
    ).rejects.toThrow('exceeded output limit');
  });

  test('kills a provider command that ignores SIGTERM after timeout', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'kasw-provider-timeout-'));
    const pidPath = join(tempDir, 'provider.pid');

    try {
      await expect(
        loadCommandSources({
          providerCommand: 'node',
          providerArgs: [
            '-e',
            [
              `require('fs').writeFileSync(${JSON.stringify(pidPath)}, String(process.pid));`,
              'process.on("SIGTERM", () => {});',
              'setInterval(() => {}, 1000);',
            ].join(''),
          ],
          objective: 'stubborn provider',
          timeoutMs: 250,
        })
      ).rejects.toThrow('timed out');

      const pid = Number(await readFile(pidPath, 'utf8'));
      await Bun.sleep(1_100);
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
