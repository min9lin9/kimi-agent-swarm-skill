import { spawn } from 'node:child_process';

export function isRedisAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('redis-cli', ['ping'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let output = '';
    proc.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });
    proc.on('close', (code: number | null) => {
      resolve(code === 0 && output.trim() === 'PONG');
    });
    proc.on('error', () => resolve(false));
  });
}
