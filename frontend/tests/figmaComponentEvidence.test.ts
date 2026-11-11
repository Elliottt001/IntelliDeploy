import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, test } from 'vitest';

import {
  auditedMobilePrimitiveKeys,
  figmaComponentEvidence,
  figmaMobileIcons,
  getFigmaMobileIcon,
} from '../design/figmaComponentEvidence';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true }),
    ),
  );
});

function createCommandsBlob(ops: Array<number | [number, ...number[]]>) {
  const chunks: number[] = [];
  for (const op of ops) {
    if (typeof op === 'number') {
      chunks.push(op);
      continue;
    }
    const [code, ...values] = op;
    chunks.push(code);
    for (const value of values) {
      const bytes = Buffer.alloc(4);
      bytes.writeFloatLE(value, 0);
      chunks.push(...bytes);
    }
  }
  return {
    bytes: {
      encoding: 'base64',
      bytes: chunks.length,
      data: Buffer.from(chunks).toString('base64'),
    },
  };
}

async function createComponentFixture({
  danglingSymbol = false,
}: {
  danglingSymbol?: boolean;
} = {}) {
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), 'figma-component-evidence-'),
  );
  temporaryDirectories.push(temporaryRoot);

  const designSource = path.join(temporaryRoot, 'design-source');
  const designData = path.join(designSource, 'design-data');
  const original = path.join(designSource, 'original');
  await mkdir(designData, { recursive: true });
  await mkdir(original, { recursive: true });

  const symbolId = danglingSymbol
    ? { localID: 999, sessionID: 9 }
    : { localID: 2, sessionID: 2 };

  await writeFile(
    path.join(designData, 'document.kiwi.json'),
    JSON.stringify({
      blobs: [
        createCommandsBlob([
          [1, 0, 0],
          [2, 10, 0],
          [2, 10, 10],
          [2, 0, 10],
          0,
        ]),
      ],
      nodeChanges: [
        {
          derivedSymbolData: [
            {
              fillGeometry: [{ commandsBlob: 0, styleID: 0, windingRule: 'NONZERO' }],
              guidPath: { guids: [{ localID: 3, sessionID: 2 }] },
            },
          ],
          guid: { localID: 1, sessionID: 1 },
          name: 'Settings instance',
          opacity: 1,
          parentIndex: {
            guid: { localID: 0, sessionID: 0 },
            position: '!',
          },
          phase: 'CREATED',
          size: { x: 10, y: 10 },
          symbolData: {
            symbolID: symbolId,
            symbolOverrides: [],
            uniformScaleFactor: 1,
          },
          transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
          type: 'INSTANCE',
          visible: true,
        },
        ...(danglingSymbol
          ? []
          : [
              {
                guid: { localID: 2, sessionID: 2 },
                name: 'Settings symbol',
                opacity: 1,
                parentIndex: {
                  guid: { localID: 0, sessionID: 0 },
                  position: '"',
                },
                phase: 'CREATED',
                size: { x: 10, y: 10 },
                transform: {
                  m00: 1,
                  m01: 0,
                  m02: 0,
                  m10: 0,
                  m11: 1,
                  m12: 0,
                },
                type: 'SYMBOL',
                visible: true,
              },
              {
                fillGeometry: [{ commandsBlob: 0, styleID: 0, windingRule: 'NONZERO' }],
                fillPaints: [
                  {
                    authoredColor: { c0: 1, c1: 1, c2: 1, c3: 1, space: 'DEFAULT' },
                    blendMode: 'NORMAL',
                    color: { a: 1, b: 1, g: 1, r: 1 },
                    opacity: 1,
                    type: 'SOLID',
                    visible: true,
                  },
                ],
                guid: { localID: 3, sessionID: 2 },
                name: 'Settings face',
                opacity: 1,
                parentIndex: {
                  guid: { localID: 2, sessionID: 2 },
                  position: '!',
                },
                phase: 'CREATED',
                size: { x: 10, y: 10 },
                transform: {
                  m00: 1,
                  m01: 0,
                  m02: 0,
                  m10: 0,
                  m11: 1,
                  m12: 0,
                },
                type: 'ROUNDED_RECTANGLE',
                visible: true,
              },
            ]),
      ],
      type: 'NODE_CHANGES',
    }),
  );

  await writeFile(
    path.join(designData, '移动端UI.nodes.json'),
    JSON.stringify({
      nodes: [
        {
          guid: { localID: 1, sessionID: 1 },
          name: 'Settings instance',
          opacity: 1,
          parentIndex: {
            guid: { localID: 0, sessionID: 0 },
            position: '!',
          },
          phase: 'CREATED',
          size: { x: 10, y: 10 },
          symbolData: {
            symbolID: symbolId,
            symbolOverrides: [],
            uniformScaleFactor: 1,
          },
          transform: {
            m00: 1,
            m01: 0,
            m02: 0,
            m10: 0,
            m11: 1,
            m12: 0,
          },
          type: 'INSTANCE',
          visible: true,
        },
      ],
    }),
  );

  const figArchive = path.join(original, 'IntelliDeploy.fig');
  execFileSync('python3', [
    '-c',
    [
      'import sys, zipfile',
      'with zipfile.ZipFile(sys.argv[1], "w") as archive:',
      '    archive.writestr("canvas.fig", b"fig-kiwi\\x00\\x00\\x00\\x00")',
      '    archive.writestr("meta.json", "{}")',
      '    archive.writestr("thumbnail.png", b"png")',
    ].join('\n'),
    figArchive,
  ]);

  return {
    designSource,
    outputPath: path.join(temporaryRoot, 'frontend/design/figmaComponentEvidence.ts'),
  };
}

describe('Figma component evidence', () => {
  test('resolves the known settings instance to its real Symbol', () => {
    expect(figmaComponentEvidence.settings).toMatchObject({
      instanceNodeIds: ['266:21480'],
      sourceKind: 'symbol',
      symbolNodeId: '248:20538',
    });
  });

  test('records a valid source, geometry, style, effects, and overrides for every audited primitive', () => {
    expect(Object.keys(figmaComponentEvidence).sort()).toEqual(
      [...auditedMobilePrimitiveKeys].sort(),
    );
    for (const evidence of Object.values(figmaComponentEvidence)) {
      expect(evidence.sourceNodeIds.length).toBeGreaterThan(0);
      expect(evidence.geometry.length).toBeGreaterThan(0);
      expect(evidence.size.width).toBeGreaterThan(0);
      expect(evidence.size.height).toBeGreaterThan(0);
      expect(evidence).toHaveProperty('fills');
      expect(evidence).toHaveProperty('strokes');
      expect(evidence).toHaveProperty('effects');
      expect(evidence).toHaveProperty('overrides');
      if (evidence.sourceKind === 'symbol') {
        expect(evidence.symbolNodeId).toMatch(/^\d+:\d+$/);
        expect(evidence.instanceNodeIds.length).toBeGreaterThan(0);
      } else {
        expect(evidence.noSymbolReason).toBe(
          'no-instance-or-symbol-in-audited-subtree',
        );
      }
    }
  });

  test('uses audited vectors for every runtime icon', () => {
    for (const name of Object.keys(figmaMobileIcons)) {
      const icon = getFigmaMobileIcon(name as keyof typeof figmaMobileIcons);
      expect(icon.sourceNodeIds.length).toBeGreaterThan(0);
      expect(icon.layers.length).toBeGreaterThan(0);
      expect(icon.layers.every((layer) => layer.path.length > 0)).toBe(true);
    }
  });

  test('contains no screenshot or remote runtime asset', async () => {
    const serialized = JSON.stringify(figmaComponentEvidence);
    expect(serialized).not.toMatch(/https?:\/\//);
    expect(serialized).not.toMatch(/page-\d+\.png|375x812|configured-assets/i);
    const evidenceModulePath = path.resolve(
      process.cwd(),
      'design/figmaComponentEvidence.ts',
    );
    await expect(
      readFile(evidenceModulePath, 'utf8'),
    ).resolves.not.toMatch(/require\([^)]*\.png|https?:\/\//);
  });

  test('refuses a dangling Symbol reference before replacing the previous output', async () => {
    const fixture = await createComponentFixture({ danglingSymbol: true });
    await mkdir(path.dirname(fixture.outputPath), { recursive: true });
    await writeFile(fixture.outputPath, 'previous output');

    const { extractMobileComponentEvidence } = await import(
      '../scripts/extract-mobile-component-evidence.mjs'
    );

    await expect(
      extractMobileComponentEvidence({
        auditedRoots: { settings: ['1:1'] } as any,
        designSource: fixture.designSource,
        outputPath: fixture.outputPath,
      }),
    ).rejects.toThrow(/dangling Symbol reference/i);
    await expect(readFile(fixture.outputPath, 'utf8')).resolves.toBe(
      'previous output',
    );
  });

  test('produces byte-identical output across repeated extraction runs', async () => {
    const fixture = await createComponentFixture();
    const { extractMobileComponentEvidence } = await import(
      '../scripts/extract-mobile-component-evidence.mjs'
    );
    const options = {
      auditedRoots: { settings: ['1:1'] } as any,
      designSource: fixture.designSource,
      outputPath: fixture.outputPath,
    };

    await extractMobileComponentEvidence(options);
    const firstOutput = await readFile(fixture.outputPath, 'utf8');

    await extractMobileComponentEvidence(options);

    await expect(readFile(fixture.outputPath, 'utf8')).resolves.toBe(firstOutput);
  });
});
