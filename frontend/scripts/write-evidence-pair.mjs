import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const asPath = (value) =>
  value instanceof URL ? fileURLToPath(value) : path.resolve(value);

const pairedAuditPath = (runtimePath) => {
  const parsed = path.parse(runtimePath);
  return path.join(parsed.dir, `${parsed.name}.audit${parsed.ext || '.ts'}`);
};

export function resolveEvidenceOutputs({ runtimeDefault, auditDefault, env = process.env }) {
  const legacy = env.INTELLIDEPLOY_EVIDENCE_OUTPUT;
  const runtime = env.INTELLIDEPLOY_RUNTIME_EVIDENCE_OUTPUT;
  const audit = env.INTELLIDEPLOY_AUDIT_EVIDENCE_OUTPUT;

  if (legacy && (runtime || audit)) {
    throw Error(
      'INTELLIDEPLOY_EVIDENCE_OUTPUT cannot be combined with explicit runtime/audit outputs',
    );
  }
  if (runtime || audit) {
    if (!runtime || !audit) {
      throw Error(
        'INTELLIDEPLOY_RUNTIME_EVIDENCE_OUTPUT and INTELLIDEPLOY_AUDIT_EVIDENCE_OUTPUT must be set together',
      );
    }
    return { runtimePath: asPath(runtime), auditPath: asPath(audit) };
  }
  if (legacy) {
    const runtimePath = asPath(legacy);
    return { runtimePath, auditPath: pairedAuditPath(runtimePath) };
  }
  return { runtimePath: asPath(runtimeDefault), auditPath: asPath(auditDefault) };
}

const failure = (operation, target, error) => ({ operation, target, error });

const aggregate = (phase, failures) =>
  new AggregateError(
    failures.map((item) => item.error),
    `${phase}: ${failures
      .map((item) => `${item.operation} ${item.target}: ${item.error?.message ?? item.error}`)
      .join('; ')}`,
  );

async function settle(tasks) {
  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  return results.flatMap((result, index) =>
    result.status === 'rejected'
      ? [failure(tasks[index].operation, tasks[index].target, result.reason)]
      : [],
  );
}

export async function writeEvidencePairAtomically(
  {
    runtimePath,
    auditPath,
    runtimeContent,
    auditContent,
  },
  {
    ops = fs,
    suffix = `${process.pid}-${randomUUID()}`,
  } = {},
) {
  if (runtimePath === auditPath) throw Error('Runtime and audit evidence targets must differ');
  const artifacts = [
    { target: runtimePath, content: runtimeContent },
    { target: auditPath, content: auditContent },
  ].map((artifact) => ({
    ...artifact,
    backup: `${artifact.target}.${suffix}.bak`,
    staged: path.join(
      path.dirname(artifact.target),
      `.${path.basename(artifact.target)}.${suffix}.tmp`,
    ),
  }));

  const stagingPreparationFailures = await settle(
    artifacts.map((artifact) => ({
      operation: 'mkdir',
      target: path.dirname(artifact.target),
      run: () => ops.mkdir(path.dirname(artifact.target), { recursive: true }),
    })),
  );
  if (stagingPreparationFailures.length) {
    throw aggregate('staging preparation failed', stagingPreparationFailures);
  }

  const stagingFailures = await settle(
    artifacts.map((artifact) => ({
      operation: 'stage write',
      target: artifact.staged,
      run: () => ops.writeFile(artifact.staged, artifact.content),
    })),
  );
  if (stagingFailures.length) {
    const cleanupFailures = await settle(
      artifacts.map((artifact) => ({
        operation: 'staged cleanup',
        target: artifact.staged,
        run: () => ops.rm(artifact.staged, { force: true }),
      })),
    );
    throw aggregate('staging failed', [...stagingFailures, ...cleanupFailures]);
  }

  // Pre-commit: until both staged files are promoted, every failure rolls back.
  const backedUp = [];
  const promoted = [];
  try {
    for (const artifact of artifacts) {
      try {
        await ops.rename(artifact.target, artifact.backup);
        backedUp.push(artifact);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    for (const artifact of artifacts) {
      await ops.rename(artifact.staged, artifact.target);
      promoted.push(artifact);
    }
  } catch (error) {
    const rollbackFailures = [];
    rollbackFailures.push(
      ...(await settle(
        promoted.map((artifact) => ({
          operation: 'promoted target removal',
          target: artifact.target,
          run: () => ops.rm(artifact.target, { force: true }),
        })),
      )),
    );
    rollbackFailures.push(
      ...(await settle(
        backedUp.map((artifact) => ({
          operation: 'backup restore',
          target: `${artifact.backup} -> ${artifact.target}`,
          run: () => ops.rename(artifact.backup, artifact.target),
        })),
      )),
    );
    rollbackFailures.push(
      ...(await settle(
        artifacts.map((artifact) => ({
          operation: 'staged cleanup',
          target: artifact.staged,
          run: () => ops.rm(artifact.staged, { force: true }),
        })),
      )),
    );
    throw aggregate(
      rollbackFailures.length
        ? 'pre-commit failed; rollback completed with issues'
        : 'pre-commit failed; rollback restored the old pair', [
      failure('pre-commit operation', 'runtime/audit pair', error),
      ...rollbackFailures,
    ]);
  }

  // Commit is complete once both promotions succeed. Cleanup must never roll it back.
  const postCommitFailures = await settle([
    ...backedUp.map((artifact) => ({
      operation: 'backup cleanup',
      target: artifact.backup,
      run: () => ops.rm(artifact.backup, { force: true }),
    })),
    ...artifacts.map((artifact) => ({
      operation: 'staged cleanup',
      target: artifact.staged,
      run: () => ops.rm(artifact.staged, { force: true }),
    })),
  ]);
  if (postCommitFailures.length) {
    throw aggregate('post-commit cleanup failed; new pair remains committed', postCommitFailures);
  }
}
