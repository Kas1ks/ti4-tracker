import { beforeEach, describe, expect, it } from 'vitest';
import {
  appendGameRecord,
  getCloudBin,
  isCloudStatsConfigured,
  resetMemoryStatsBin,
} from './statsBin.js';

describe('statsBin memory fallback', () => {
  beforeEach(() => {
    resetMemoryStatsBin();
  });

  it('is configured in vite/dev without STATS_STORE', () => {
    expect(isCloudStatsConfigured({})).toBe(false);
    expect(isCloudStatsConfigured({ DEV: 'true' })).toBe(true);
    expect(isCloudStatsConfigured({ ALLOW_VITE_SECRET_FALLBACK: '1' })).toBe(true);
  });

  it('stores history via appendGameRecord without JSONBin', async () => {
    const env = { DEV: 'true' };
    await appendGameRecord(env, { id: 42, winner: 'Без победителя' });
    const bin = await getCloudBin(env);
    expect(bin.history[0]).toMatchObject({ id: 42 });
  });
});
