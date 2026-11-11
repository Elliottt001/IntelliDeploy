import { expect, test, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View' }));
import { visualPendingRoutes, visualAcceptanceStatus } from '../components/mobile/VisualPendingSection';
test('only the four approved page families remain visually pending', () => {
  expect(visualPendingRoutes).toEqual(['/register', '/billing', '/app-detail/[id]:secondary', '/community/[id]']);
  expect(visualAcceptanceStatus).toBe('VISUAL_PENDING');
});

test.skipIf(!process.env.INTELLIDEPLOY_FIGMA_SOURCE)('pending pages consume the actual audited Figma brand/card shell without inventing page baselines', async () => {
  const { readFile, mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { default: path } = await import('node:path');
  const { figmaComponentEvidence } = await import('../design/figmaComponentEvidence');
  const { extractMobileComponentEvidence } = await import('../scripts/extract-mobile-component-evidence.mjs');
  const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE!;
  const document = JSON.parse(await readFile(path.join(source, 'design-data/document.kiwi.json'), 'utf8'));
  const nodes = new Map(document.nodeChanges.map((node: any) => [`${node.guid.sessionID}:${node.guid.localID}`, node])) as Map<string, any>;
  const shell = nodes.get('825:6570');
  expect(shell).toMatchObject({ type: 'FRAME', cornerRadius: 24, strokeWeight: 1, size: { x: 441.54998779296875, y: 200.5 } });
  expect(figmaComponentEvidence.glassCard.surfaceNodeId).toBe('825:6570');
  expect(figmaComponentEvidence.glassCard.cornerRadii.topLeft).toBe(shell.cornerRadius);
  expect(figmaComponentEvidence.glassCard.surfaceFills[0].opacity).toBeCloseTo(shell.fillPaints[0].opacity, 6);
  expect(shell.effects).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'DROP_SHADOW', radius: 32, offset: { x: 0, y: 8 } }), expect.objectContaining({ type: 'BACKGROUND_BLUR', radius: 16 })]));
  const root = figmaComponentEvidence.brandMark.sourceNodeIds[0];
  expect(nodes.has(root)).toBe(true);
  expect(figmaComponentEvidence.brandMark.sourceKind).toBe('node');
  expect(figmaComponentEvidence.brandMark.noSymbolReason).toBe('no-instance-or-symbol-in-audited-subtree');
  const temporary = await mkdtemp(path.join(tmpdir(), 'pending-shell-source-'));
  try {
    const outputPath = path.join(temporary, 'evidence.ts');
    await extractMobileComponentEvidence({ designSource: source, outputPath });
    expect(await readFile(outputPath, 'utf8')).toBe(await readFile(decodeURIComponent(new URL('../design/figmaComponentEvidence.ts', import.meta.url).pathname), 'utf8'));
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
