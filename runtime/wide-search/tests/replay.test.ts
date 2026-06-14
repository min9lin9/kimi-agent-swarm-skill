import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runWideSearch } from '../src/runtime';

describe('replay', () => {
  test('replay creates a new run with the same inputs', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-replay-'));

    const first = await runWideSearch({
      objective: 'Original objective',
      profile: 'fixture',
      workDir,
    });

    const replay = await runWideSearch({
      replayRunId: first.runId,
      workDir,
    });

    expect(replay.runId).not.toBe(first.runId);
    expect(replay.runDir).not.toBe(first.runDir);

    const replayRun = JSON.parse(await Bun.file(join(replay.runDir, 'run.json')).text());
    expect(replayRun.objective).toBe('Original objective');
    expect(replayRun.executionProfile).toBe('fixture');
    expect(replayRun.replayedFrom).toBe(first.runId);
  });
});
