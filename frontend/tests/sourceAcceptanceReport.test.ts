import { expect, test } from 'vitest';
import { isStrictSourcePass, summarizeSourceAcceptance } from '../scripts/summarize-mobile-source-acceptance.mjs';

const hash = 'a'.repeat(64);
const record = () => ({ frameId: '119:76618', sourceSha256: hash, dataEvidence: 'existing-api', checks: {
  STRUCTURE: 'PASS', RESPONSIVE_GEOMETRY: 'PASS', TEXT_STYLE: 'PASS', PAINT_EFFECT: 'PASS', MOTION_INTERACTION: 'PASS', DATA_BINDING: 'PASS',
}, evidence: ['measured'] });

test('missing effect support cannot become strict acceptance', () => {
  expect(isStrictSourcePass({ ...record(), dataEvidence: 'fixture', checks: { ...record().checks, PAINT_EFFECT: 'NOT_IMPLEMENTED', MOTION_INTERACTION: 'NOT_RUN' } })).toBe(false);
});
test('fixture data cannot become strict acceptance even when all six checks pass', () => {
  expect(isStrictSourcePass({ ...record(), dataEvidence: 'fixture' })).toBe(false);
});
test('strict pass requires exactly the six named aspects', () => {
  expect(isStrictSourcePass(record())).toBe(true);
  expect(isStrictSourcePass({ ...record(), checks: { a: 'PASS', b: 'PASS', c: 'PASS', d: 'PASS', e: 'PASS', f: 'PASS' } })).toBe(false);
  expect(isStrictSourcePass({ ...record(), checks: { ...record().checks, extra: 'PASS' } })).toBe(false);
});
test.each(['FAIL', 'NOT_RUN', 'NOT_IMPLEMENTED', 'API_UNAVAILABLE', 'BACKEND_BLOCKED'])('preserves %s and every original evidence field', status => {
  const input = { ...record(), checks: { ...record().checks, DATA_BINDING: status }, measurements: { width: 375 } };
  const result = summarizeSourceAcceptance([input], [input.frameId], hash);
  expect(result.overall).toBe('INCOMPLETE');
  expect(result.records).toEqual([input]);
});
test('rejects missing, duplicated and unexpected frames including duplicated expected manifest', () => {
  expect(() => summarizeSourceAcceptance([], [record().frameId], hash)).toThrow('Incomplete source states');
  expect(() => summarizeSourceAcceptance([record(), record()], [record().frameId, 'other'], hash)).toThrow('Incomplete source states');
  expect(() => summarizeSourceAcceptance([record()], ['other'], hash)).toThrow('Incomplete source states');
  expect(() => summarizeSourceAcceptance([record(), record()], [record().frameId, record().frameId], hash)).toThrow('Incomplete source states');
});
test('rejects mixed, invalid or absent source hashes', () => {
  for (const expected of ['', 'fixture-source', hash.toUpperCase()]) expect(() => summarizeSourceAcceptance([record()], [record().frameId], expected)).toThrow('Mixed or invalid source versions');
  expect(() => summarizeSourceAcceptance([{ ...record(), sourceSha256: 'b'.repeat(64) }], [record().frameId], hash)).toThrow('Mixed or invalid source versions');
});
test('only verified API evidence allows overall PASS', () => {
  expect(summarizeSourceAcceptance([record()], [record().frameId], hash).overall).toBe('PASS');
  expect(isStrictSourcePass({ ...record(), dataEvidence: 'readonly-api-snapshot' })).toBe(true);
  expect(isStrictSourcePass({ ...record(), dataEvidence: 'unavailable' })).toBe(false);
});
