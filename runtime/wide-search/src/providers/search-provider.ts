import type { SearchDepth, Source } from '../types';

export interface SearchOptions {
  objective: string;
  depth: SearchDepth;
  maxResults: number;
}

export interface SearchProvider {
  readonly name: string;
  search(options: SearchOptions): Promise<Source[]>;
}
