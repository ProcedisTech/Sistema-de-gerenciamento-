/**
 * Regressão: seed placeholder nunca vira org válida; sanitize limpa LS/env.
 */
import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_ORG_ID,
  isPlaceholderOrgId,
  sanitizeOrgId,
} from './apiEnv.js';

describe('isPlaceholderOrgId / sanitizeOrgId', () => {
  it('reconhece a seed histórica b000…0001', () => {
    expect(isPlaceholderOrgId(PLACEHOLDER_ORG_ID)).toBe(true);
    expect(isPlaceholderOrgId(PLACEHOLDER_ORG_ID.toUpperCase())).toBe(true);
    expect(isPlaceholderOrgId(` ${PLACEHOLDER_ORG_ID} `)).toBe(true);
  });

  it('sanitizeOrgId zera placeholder, null e inválidos', () => {
    expect(sanitizeOrgId(PLACEHOLDER_ORG_ID)).toBe('');
    expect(sanitizeOrgId(null)).toBe('');
    expect(sanitizeOrgId('')).toBe('');
    expect(sanitizeOrgId('not-a-uuid')).toBe('');
  });

  it('sanitizeOrgId preserva UUID real', () => {
    const real = 'd0000000-0000-0000-0000-0000000000aa';
    expect(sanitizeOrgId(real)).toBe(real);
    expect(isPlaceholderOrgId(real)).toBe(false);
  });
});
