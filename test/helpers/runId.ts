import { randomUUID } from 'node:crypto';

let cached: string | null = null;

export function getRunId(prefix = 'vitest'): string {
  if (cached) return cached;
  cached = `${prefix}_${randomUUID()}`;
  return cached;
}
