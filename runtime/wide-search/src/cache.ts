import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { CacheKey, Source } from './types';

export interface CacheEntry {
  sources: Source[];
  cachedAt: string;
}

export function getCacheDir(): string {
  return join(homedir(), '.kasw', 'cache');
}

export function cacheKeyHash(key: CacheKey): string {
  const normalized = JSON.stringify({
    provider: key.provider,
    objective: key.objective.trim().toLowerCase(),
    depth: key.depth,
    maxResults: key.maxResults,
  });
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

function cacheFilePath(key: CacheKey): string {
  return join(getCacheDir(), `${cacheKeyHash(key)}.json`);
}

export async function getCachedSources(
  key: CacheKey,
  ttlHours = 168 // 7 days default
): Promise<Source[] | undefined> {
  const path = cacheFilePath(key);
  try {
    const text = await readFile(path, 'utf8');
    const entry = JSON.parse(text) as CacheEntry;

    const cachedAt = new Date(entry.cachedAt).getTime();
    const now = Date.now();
    const ttlMs = ttlHours * 60 * 60 * 1000;
    if (now - cachedAt > ttlMs) {
      return undefined;
    }

    return entry.sources;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

export async function setCachedSources(key: CacheKey, sources: Source[]): Promise<void> {
  const path = cacheFilePath(key);
  await mkdir(getCacheDir(), { recursive: true });
  const entry: CacheEntry = {
    sources,
    cachedAt: new Date().toISOString(),
  };
  await writeFile(path, `${JSON.stringify(entry, null, 2)}\n`);
}

export async function clearCache(): Promise<number> {
  const dir = getCacheDir();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 0;
    }
    throw error;
  }

  let removed = 0;
  for (const file of files) {
    if (file.endsWith('.json')) {
      await unlink(join(dir, file));
      removed += 1;
    }
  }
  return removed;
}
