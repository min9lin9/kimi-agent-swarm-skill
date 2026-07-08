import { describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const probeValue = 'REDACTED_PROBE_VALUE';

interface ScriptResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function runPublishScript(
  fakeBinDir: string,
  env: Record<string, string | undefined> = {}
): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['scripts/publish.sh', '--dry-run'], {
      cwd: rootDir,
      env: {
        ...process.env,
        ...env,
        NPM_TOKEN: probeValue,
        PATH: `${fakeBinDir}:${process.env.PATH ?? ''}`,
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function writeFakeBun(fakeBinDir: string, version = '1.0.2'): Promise<void> {
  await writeFile(
    join(fakeBinDir, 'bun'),
    `#!/usr/bin/env bash
if [[ "$1" == "-p" && "$2" == *".name"* ]]; then
  echo "kimi-agent-swarm-cli"
  exit 0
fi
if [[ "$1" == "-p" && "$2" == *".version"* ]]; then
  echo "${version}"
  exit 0
fi
echo "fake bun $*" >&2
exit 0
`
  );
  await chmod(join(fakeBinDir, 'bun'), 0o755);
}

describe('publish helper', () => {
  test('stops before publish when the current package version is already published', async () => {
    // Given: npm reports the package's current version as already published.
    const fakeBinDir = await mkdtemp(join(tmpdir(), 'kasw-publish-bin-'));
    const npmLogPath = join(fakeBinDir, 'npm-calls.log');
    try {
      await writeFakeBun(fakeBinDir);
      await writeFile(
        join(fakeBinDir, 'npm'),
        `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${npmLogPath}"
if [[ "$1" == "view" ]]; then
  echo "1.0.2"
  exit 0
fi
if [[ "$1" == "publish" ]]; then
  echo "PUBLISH CALLED"
  exit 0
fi
echo "fake npm $*"
exit 0
`
      );
      await chmod(join(fakeBinDir, 'npm'), 0o755);

      // When: the publish helper runs in dry-run mode.
      const result = await runPublishScript(fakeBinDir);

      // Then: it exits before publishing and does not leak token-like text.
      const output = `${result.stdout}\n${result.stderr}`;
      const npmCalls = await readFile(npmLogPath, 'utf8');
      expect(result.exitCode).toBe(1);
      expect(output).toInclude('already published');
      expect(output).not.toInclude(probeValue);
      expect(npmCalls).not.toInclude('publish');
    } finally {
      await rm(fakeBinDir, { recursive: true, force: true });
    }
    expect(await pathExists(fakeBinDir)).toBe(false);
  });

  test('fails closed when npm view returns an unexpected error', async () => {
    // Given: npm view fails for a reason other than an unpublished version.
    const fakeBinDir = await mkdtemp(join(tmpdir(), 'kasw-publish-bin-'));
    const npmLogPath = join(fakeBinDir, 'npm-calls.log');
    try {
      await writeFakeBun(fakeBinDir);
      await writeFile(
        join(fakeBinDir, 'npm'),
        `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${npmLogPath}"
if [[ "$1" == "view" ]]; then
  echo "registry unavailable" >&2
  exit 42
fi
if [[ "$1" == "publish" ]]; then
  echo "PUBLISH CALLED"
  exit 0
fi
echo "fake npm $*"
exit 0
`
      );
      await chmod(join(fakeBinDir, 'npm'), 0o755);

      // When: the publish helper runs in dry-run mode.
      const result = await runPublishScript(fakeBinDir);

      // Then: it fails closed before pack/publish guidance.
      const output = `${result.stdout}\n${result.stderr}`;
      const npmCalls = await readFile(npmLogPath, 'utf8');
      expect(result.exitCode).toBe(42);
      expect(output).toInclude('registry unavailable');
      expect(output).not.toInclude('Publish dry-run complete');
      expect(output).not.toInclude('npm publish --access public');
      expect(npmCalls).not.toInclude('pack');
      expect(npmCalls).not.toInclude('publish');
    } finally {
      await rm(fakeBinDir, { recursive: true, force: true });
    }
    expect(await pathExists(fakeBinDir)).toBe(false);
  });

  test('pins npm registry during publish preflight', async () => {
    const fakeBinDir = await mkdtemp(join(tmpdir(), 'kasw-publish-bin-'));
    const npmLogPath = join(fakeBinDir, 'npm-calls.log');
    try {
      await writeFakeBun(fakeBinDir, '9.9.9-test');
      await writeFile(
        join(fakeBinDir, 'npm'),
        `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${npmLogPath}"
if [[ "$1" == "view" ]]; then
  echo "npm ERR! code E404" >&2
  exit 1
fi
if [[ "$1" == "pack" ]]; then
  exit 0
fi
exit 0
`
      );
      await chmod(join(fakeBinDir, 'npm'), 0o755);

      const result = await runPublishScript(fakeBinDir, {
        NPM_CONFIG_REGISTRY: 'https://evil.invalid/',
      });

      const npmCalls = await readFile(npmLogPath, 'utf8');
      expect(result.exitCode).toBe(0);
      expect(npmCalls).toInclude('--registry https://registry.npmjs.org/');
    } finally {
      await rm(fakeBinDir, { recursive: true, force: true });
    }
    expect(await pathExists(fakeBinDir)).toBe(false);
  });
});
