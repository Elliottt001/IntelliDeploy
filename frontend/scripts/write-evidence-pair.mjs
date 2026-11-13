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

export async function writeEvidencePairAtomically({
  runtimePath,
  auditPath,
  runtimeContent,
  auditContent,
}) {
  if (runtimePath === auditPath) throw Error('Runtime and audit evidence targets must differ');
  const suffix = `${process.pid}-${randomUUID()}`;
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

  await Promise.all(
    artifacts.map((artifact) => fs.mkdir(path.dirname(artifact.target), { recursive: true })),
  );
  try {
    await Promise.all(
      artifacts.map((artifact) => fs.writeFile(artifact.staged, artifact.content)),
    );
  } catch (error) {
    await Promise.all(artifacts.map((artifact) => fs.rm(artifact.staged, { force: true })));
    throw error;
  }

  const backedUp = [];
  const promoted = [];
  try {
    for (const artifact of artifacts) {
      try {
        await fs.rename(artifact.target, artifact.backup);
        backedUp.push(artifact);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    for (const artifact of artifacts) {
      await fs.rename(artifact.staged, artifact.target);
      promoted.push(artifact);
    }
    await Promise.all(backedUp.map((artifact) => fs.rm(artifact.backup, { force: true })));
  } catch (error) {
    await Promise.all(promoted.map((artifact) => fs.rm(artifact.target, { force: true })));
    for (const artifact of backedUp.reverse()) {
      await fs.rename(artifact.backup, artifact.target);
    }
    throw error;
  } finally {
    await Promise.all(artifacts.map((artifact) => fs.rm(artifact.staged, { force: true })));
  }
}
