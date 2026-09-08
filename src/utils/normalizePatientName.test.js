import { describe, expect, it } from 'vitest';
import { normalizePatientName } from './normalizePatientName';

describe('normalizePatientName', () => {
  it.each([
    ['maria da silva', 'Maria da Silva'],
    ['ANA PAULA', 'Ana Paula'],
    ['josé DOS santos', 'José dos Santos'],
    ['maria  silva', 'Maria Silva'],
    ['  joão  ', 'João'],
    ['da silva neto', 'Da Silva Neto'],
    ['ana', 'Ana'],
    ['', ''],
    [null, null],
  ])('%j -> %j', (input, expected) => {
    expect(normalizePatientName(input)).toBe(expected);
  });
});
