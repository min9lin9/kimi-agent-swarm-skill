import { createConnection } from 'node:net';

export function isRedisAvailable(
  url = process.env.REDIS_URL ?? 'redis://localhost:6379'
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname || 'localhost';
      const port = Number(parsed.port || 6379);
      const socket = createConnection({ host, port });
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.setTimeout(1000, () => {
        socket.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}
