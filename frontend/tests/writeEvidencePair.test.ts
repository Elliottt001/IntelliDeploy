import fsPromises from 'node:fs/promises';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';

import { writeEvidencePairAtomically } from '../scripts/write-evidence-pair.mjs';

type FsMethod = 'mkdir' | 'rename' | 'rm' | 'writeFile';
type Rule = {
  method: FsMethod;
  matches: (args: unknown[]) => boolean;
  remaining?: number;
};

const injectedError = () => Object.assign(new Error('injected I/O failure'), { code: 'EIO' });

function faultingOps(rules: Rule[], calls: string[]) {
  const ops = { ...fsPromises };
  for (const method of ['mkdir', 'rename', 'rm', 'writeFile'] as const) {
    const real = fsPromises[method].bind(fsPromises) as (...args: any[]) => Promise<any>;
    (ops as any)[method] = async (...args: any[]) => {
      calls.push(`${method}:${args.slice(0, 2).join('->')}`);
      const rule = rules.find(
        (candidate) =>
          candidate.method === method &&
          (candidate.remaining ?? 1) > 0 &&
          candidate.matches(args),
      );
      if (rule) {
        rule.remaining = (rule.remaining ?? 1) - 1;
        throw injectedError();
      }
      return real(...args);
    };
  }
  return ops;
}

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'task7-pair-fault-'));
  const runtimePath = path.join(directory, 'runtime.ts');
  const auditPath = path.join(directory, 'audit.ts');
  writeFileSync(runtimePath, 'old-runtime');
  writeFileSync(auditPath, 'old-audit');
  return {
    auditPath,
    directory,
    runtimePath,
    args: {
      auditContent: 'new-audit',
      auditPath,
      runtimeContent: 'new-runtime',
      runtimePath,
    },
  };
}

const files = (directory: string) => readdirSync(directory).sort();
const contents = (runtimePath: string, auditPath: string) => ({
  audit: readFileSync(auditPath, 'utf8'),
  runtime: readFileSync(runtimePath, 'utf8'),
});

test.each([1, 2])('backup rename failure %i restores the complete old pair', async (failAt) => {
  const state = fixture();
  let backupCall = 0;
  const calls: string[] = [];
  const ops = faultingOps(
    [{
      method: 'rename',
      matches: (args) => String(args[1]).endsWith('.bak') && ++backupCall === failAt,
    }],
    calls,
  );
  await expect(
    writeEvidencePairAtomically(state.args, { ops, suffix: 'fault' }),
  ).rejects.toThrow(/pre-commit/i);
  expect(contents(state.runtimePath, state.auditPath)).toEqual({
    audit: 'old-audit',
    runtime: 'old-runtime',
  });
  expect(files(state.directory)).toEqual(['audit.ts', 'runtime.ts']);
});

test.each([1, 2])('promote failure %i restores the complete old pair', async (failAt) => {
  const state = fixture();
  let promoteCall = 0;
  const calls: string[] = [];
  const ops = faultingOps(
    [{
      method: 'rename',
      matches: (args) => String(args[0]).endsWith('.tmp') && ++promoteCall === failAt,
    }],
    calls,
  );
  await expect(
    writeEvidencePairAtomically(state.args, { ops, suffix: 'fault' }),
  ).rejects.toThrow(/pre-commit/i);
  expect(contents(state.runtimePath, state.auditPath)).toEqual({
    audit: 'old-audit',
    runtime: 'old-runtime',
  });
  expect(files(state.directory)).toEqual(['audit.ts', 'runtime.ts']);
});

test('staging failure leaves both old targets and no residue', async () => {
  const state = fixture();
  let writeCall = 0;
  const calls: string[] = [];
  const ops = faultingOps(
    [{ method: 'writeFile', matches: () => ++writeCall === 2 }],
    calls,
  );
  await expect(
    writeEvidencePairAtomically(state.args, { ops, suffix: 'fault' }),
  ).rejects.toThrow(/staging/i);
  expect(contents(state.runtimePath, state.auditPath)).toEqual({
    audit: 'old-audit',
    runtime: 'old-runtime',
  });
  expect(files(state.directory)).toEqual(['audit.ts', 'runtime.ts']);
});

test('partial post-commit backup cleanup keeps the new pair and recoverable backup', async () => {
  const state = fixture();
  const runtimeBackup = `${state.runtimePath}.fault.bak`;
  const calls: string[] = [];
  const ops = faultingOps(
    [{ method: 'rm', matches: (args) => args[0] === runtimeBackup }],
    calls,
  );
  await expect(
    writeEvidencePairAtomically(state.args, { ops, suffix: 'fault' }),
  ).rejects.toThrow(new RegExp(`post-commit.*${runtimeBackup.replaceAll('.', '\\.')}`, 's'));
  expect(contents(state.runtimePath, state.auditPath)).toEqual({
    audit: 'new-audit',
    runtime: 'new-runtime',
  });
  expect(readFileSync(runtimeBackup, 'utf8')).toBe('old-runtime');
  expect(files(state.directory)).toEqual([
    'audit.ts',
    'runtime.ts',
    'runtime.ts.fault.bak',
  ]);
});

test('one restore failure does not prevent the other restore or staged cleanup', async () => {
  const state = fixture();
  const runtimeBackup = `${state.runtimePath}.fault.bak`;
  let promoteCall = 0;
  const calls: string[] = [];
  const ops = faultingOps(
    [
      {
        method: 'rename',
        matches: (args) => String(args[0]).endsWith('.tmp') && ++promoteCall === 2,
      },
      {
        method: 'rename',
        matches: (args) => args[0] === runtimeBackup && args[1] === state.runtimePath,
      },
    ],
    calls,
  );
  await expect(
    writeEvidencePairAtomically(state.args, { ops, suffix: 'fault' }),
  ).rejects.toThrow(new RegExp(`rollback.*${runtimeBackup.replaceAll('.', '\\.')}`, 's'));
  expect(readFileSync(state.auditPath, 'utf8')).toBe('old-audit');
  expect(readFileSync(runtimeBackup, 'utf8')).toBe('old-runtime');
  expect(files(state.directory)).toEqual(['audit.ts', 'runtime.ts.fault.bak']);
  expect(calls.some((call) => call.includes(`rename:${state.auditPath}.fault.bak->${state.auditPath}`))).toBe(true);
  expect(calls.filter((call) => call.includes('.tmp')).some((call) => call.startsWith('rm:'))).toBe(true);
});
