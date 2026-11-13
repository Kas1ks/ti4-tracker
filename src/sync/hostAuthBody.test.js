import { describe, expect, it } from 'vitest';
import { hostAuthBody, looksLikeHostWriteToken } from './hostWriteToken.js';

describe('hostAuthBody', () => {
  it('sends createSecret for master secret', () => {
    expect(hostAuthBody('host-only')).toEqual({ createSecret: 'host-only' });
    expect(looksLikeHostWriteToken('host-only')).toBe(false);
  });

  it('sends writeToken for compact HMAC tokens', () => {
    const token = 'eyJ2IjoxfQ.sigbyteshere';
    expect(looksLikeHostWriteToken(token)).toBe(true);
    expect(hostAuthBody(token)).toEqual({ writeToken: token });
  });
});
