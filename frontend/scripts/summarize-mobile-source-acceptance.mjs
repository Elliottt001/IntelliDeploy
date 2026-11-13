export const sourceAspects = ['STRUCTURE', 'RESPONSIVE_GEOMETRY', 'TEXT_STYLE', 'PAINT_EFFECT', 'MOTION_INTERACTION', 'DATA_BINDING'];

/** @param {{checks: Record<string, string>, dataEvidence: string}} record */
export function isStrictSourcePass(record) {
  return Object.keys(record.checks).length === sourceAspects.length
    && sourceAspects.every(aspect => record.checks[aspect] === 'PASS')
    && ['existing-api', 'readonly-api-snapshot'].includes(record.dataEvidence);
}

/**
 * @template {{frameId: string, sourceSha256: string, checks: Record<string, string>, dataEvidence: string}} T
 * @param {T[]} records
 * @param {readonly string[]} expectedFrames
 * @param {string} expectedSourceHash
 */
export function summarizeSourceAcceptance(records, expectedFrames, expectedSourceHash) {
  const ids = records.map(record => record.frameId);
  if (ids.length !== expectedFrames.length || new Set(ids).size !== ids.length
    || new Set(expectedFrames).size !== expectedFrames.length
    || expectedFrames.some(id => !ids.includes(id))) throw Error('Incomplete source states');
  if (!/^[0-9a-f]{64}$/.test(expectedSourceHash)
    || records.some(record => record.sourceSha256 !== expectedSourceHash)) throw Error('Mixed or invalid source versions');
  return { overall: records.every(isStrictSourcePass) ? 'PASS' : 'INCOMPLETE', records };
}
