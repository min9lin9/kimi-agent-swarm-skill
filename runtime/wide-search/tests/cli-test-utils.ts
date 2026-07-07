import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

export function parseCliJson(stdout: string): unknown {
  const lines = stdout.split(/\r?\n/);
  const startIndex = lines.findIndex(
    (line) => line.trim().startsWith('{') || line.trim().startsWith('[')
  );
  if (startIndex === -1) {
    throw new Error('No JSON object found in CLI stdout');
  }
  return JSON.parse(lines.slice(startIndex).join('\n'));
}

export function runCli(
  args: readonly string[],
  options: { readonly cwd?: string } = {}
): Promise<{ readonly exitCode: number | null; readonly stdout: string; readonly stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli.ts', ...args], {
      cwd: options.cwd ?? rootDir,
      env: process.env,
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
