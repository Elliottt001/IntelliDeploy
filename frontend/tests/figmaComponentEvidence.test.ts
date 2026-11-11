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
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';

import {
  auditedMobilePrimitiveKeys,
  figmaComponentEvidence,
  figmaMobileIcons,
  getFigmaMobileIcon,
} from '../design/figmaComponentEvidence';

const temporaryDirectories: string[] = [];
const formalDesignDocumentPath =
  '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221/design-data/document.kiwi.json';

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
  invalidSymbolTarget = false,
}: {
  danglingSymbol?: boolean;
  invalidSymbolTarget?: boolean;
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
    : invalidSymbolTarget
      ? { localID: 3, sessionID: 2 }
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
        createCommandsBlob([
          [1, 1, 1],
          [2, 9, 1],
          [2, 9, 9],
          [2, 1, 9],
          0,
        ]),
        createCommandsBlob([
          [1, 0, 0],
          [2, 10, 0],
          [2, 10, 2],
          [2, 0, 2],
          0,
        ]),
      ],
      nodeChanges: [
        {
          componentProperties: {
            state: {
              type: 'VARIANT',
              value: 'Danger',
            },
          },
          derivedSymbolData: [
            {
              fillGeometry: [{ commandsBlob: 1, styleID: 0, windingRule: 'NONZERO' }],
              guidPath: { guids: [{ localID: 3, sessionID: 2 }] },
            },
            {
              guidPath: { guids: [{ localID: 4, sessionID: 2 }] },
              strokeGeometry: [
                { commandsBlob: 2, styleID: 0, windingRule: 'NONZERO' },
              ],
            },
          ],
          guid: { localID: 1, sessionID: 1 },
          name: 'Settings instance',
          opacity: 0.5,
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
          transform: { m00: 1, m01: 0, m02: 4, m10: 0, m11: 1, m12: 5 },
          type: 'INSTANCE',
          visible: true,
        },
        ...(danglingSymbol
          ? []
          : [
              {
                componentPropertyDefinitions: {
                  state: {
                    defaultValue: 'Default',
                    type: 'VARIANT',
                  },
                },
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
                    opacity: 0.4,
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
              {
                guid: { localID: 4, sessionID: 2 },
                name: 'Settings line',
                opacity: 0.8,
                parentIndex: {
                  guid: { localID: 2, sessionID: 2 },
                  position: '"',
                },
                phase: 'CREATED',
                size: { x: 10, y: 2 },
                strokeCap: 'ROUND',
                strokeGeometry: [
                  { commandsBlob: 2, styleID: 0, windingRule: 'NONZERO' },
                ],
                strokeJoin: 'ROUND',
                strokePaints: [
                  {
                    authoredColor: { c0: 1, c1: 0, c2: 0, c3: 1, space: 'DEFAULT' },
                    blendMode: 'NORMAL',
                    color: { a: 1, b: 0, g: 0, r: 1 },
                    opacity: 0.5,
                    type: 'SOLID',
                    visible: true,
                  },
                ],
                strokeWeight: 1.5,
                transform: {
                  m00: 1,
                  m01: 0,
                  m02: 0,
                  m10: 0,
                  m11: 1,
                  m12: 0,
                },
                type: 'LINE',
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
          opacity: 0.5,
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
            m02: 4,
            m10: 0,
            m11: 1,
            m12: 5,
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

async function loadExtractedModule(outputPath: string) {
  return import(`${pathToFileURL(outputPath).href}?t=${Date.now()}`);
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

  test('normalizes the back icon to glyph bounds and filled outline layers', () => {
    const back = getFigmaMobileIcon('back');

    expect(back.viewBox).toBe('0 0 13.000041 13.5');
    expect(back.sourceNodeIds).toEqual(['845:3506', '845:3507', '845:3508']);
    expect(back.layers).toEqual([
      {
        fill: '#494A64',
        fillRule: 'nonzero',
        opacity: 1,
        path: 'M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M12.25 0 C12.664213 0 13 -0.335786 13 -0.75 C13 -1.164214 12.664213 -1.5 12.25 -1.5 L12.25 -0.75 L12.25 0 Z M0.75 -0.75 L0.75 0 L12.25 0 L12.25 -0.75 L12.25 -1.5 L0.75 -1.5 L0.75 -0.75 Z',
        sourceNodeId: '845:3508',
        strokeLinecap: 'round',
        strokeLinejoin: 'miter',
        transform: 'matrix(-1 0 0 -1 13 6)',
      },
      {
        fill: '#494A64',
        fillRule: 'nonzero',
        opacity: 1,
        path: 'M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z',
        sourceNodeId: '845:3506',
        strokeLinecap: 'round',
        strokeLinejoin: 'miter',
        transform: 'matrix(-0.640184 0.768221 -0.768221 -0.640184 5.416687 0)',
      },
      {
        fill: '#494A64',
        fillRule: 'nonzero',
        opacity: 1,
        path: 'M0.75 -1.5 C0.335786 -1.5 0 -1.164214 0 -0.75 C0 -0.335786 0.335786 0 0.75 0 L0.75 -0.75 L0.75 -1.5 Z M7.711104 0 C8.125318 0 8.461104 -0.335786 8.461104 -0.75 C8.461104 -1.164214 8.125318 -1.5 7.711104 -1.5 L7.711104 -0.75 L7.711104 0 Z M0.75 -0.75 L0.75 0 L7.711104 0 L7.711104 -0.75 L7.711104 -1.5 L0.75 -1.5 L0.75 -0.75 Z',
        sourceNodeId: '845:3507',
        strokeLinecap: 'round',
        strokeLinejoin: 'miter',
        transform: 'matrix(-0.640184 -0.768221 -0.768221 0.640184 5.416687 13.5)',
      },
    ]);
  });

  test('preserves the formal near-transparent bell background layer opacity', () => {
    expect(figmaComponentEvidence.bell.geometry[0]).toMatchObject({
      fill: '#000000',
      fillRule: 'nonzero',
      opacity: 0.0001,
      path: 'M0 0 L15 0 L15 15 L0 15 L0 0 Z',
      sourceNodeId: '825:6483',
    });
  });

  test('preserves exact bottom-nav shell paint, effect, border, and radii evidence', () => {
    expect(figmaComponentEvidence.bottomNav).toMatchObject({
      borderWidths: {
        bottom: 1.339601,
        left: 1.339601,
        right: 1.339601,
        top: 1.339601,
      },
      cornerRadii: {
        bottomLeft: 44.653347,
        bottomRight: 44.653347,
        topLeft: 44.653347,
        topRight: 44.653347,
      },
      surfaceNodeId: '270:26530',
    });
    expect(figmaComponentEvidence.bottomNav.surfaceFills?.[0]).toMatchObject({
      color: '#FFFFFF',
      opacity: 0.7,
      type: 'SOLID',
    });
    expect(figmaComponentEvidence.bottomNav.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: '#BABABA',
          opacity: 0.25,
          radius: 2.679201,
          type: 'DROP_SHADOW',
        }),
        expect.objectContaining({
          color: '#000000',
          opacity: 0.15,
          rawType: 'GLASS',
          secondaryColor: '#FFFFFF',
          type: 'BACKGROUND_BLUR',
        }),
      ]),
    );
  });

  test('preserves exact glass-card shell evidence and records the former content node relationship', () => {
    expect(figmaComponentEvidence.glassCard).toMatchObject({
      borderWidths: {
        bottom: 1,
        left: 1,
        right: 1,
        top: 1,
      },
      cornerRadii: {
        bottomLeft: 24,
        bottomRight: 24,
        topLeft: 24,
        topRight: 24,
      },
      size: {
        height: 200.5,
        width: 441.549988,
      },
      sourceNodeIds: expect.arrayContaining(['825:6570', '825:6575']),
      surfaceNodeId: '825:6570',
    });
    expect(figmaComponentEvidence.glassCard.surfaceFills).toEqual([
      {
        color: '#FFFFFF',
        opacity: 0.65,
        type: 'SOLID',
        variableIds: [],
      },
    ]);
    expect(figmaComponentEvidence.glassCard.surfaceStrokes).toEqual([
      {
        color: '#FFFFFF',
        opacity: 0.4,
        type: 'SOLID',
        variableIds: [],
      },
    ]);
    expect(figmaComponentEvidence.glassCard.surfaceEffects).toEqual([
      {
        blendMode: 'NORMAL',
        blurOpType: 'NORMAL',
        color: '#000000',
        offset: { x: 0, y: 0 },
        opacity: 1,
        radius: 16,
        rawType: 'BACKGROUND_BLUR',
        showShadowBehindNode: true,
        spread: 0,
        type: 'BACKGROUND_BLUR',
      },
      {
        blendMode: 'NORMAL',
        color: '#1F2687',
        offset: { x: 0, y: 8 },
        opacity: 0.07,
        radius: 32,
        rawType: 'DROP_SHADOW',
        showShadowBehindNode: false,
        spread: 0,
        type: 'DROP_SHADOW',
      },
    ]);
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

  test('rejects non-SYMBOL instance targets before replacing the previous output', async () => {
    const fixture = await createComponentFixture({ invalidSymbolTarget: true });
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
    ).rejects.toThrow(/expected a SYMBOL target/i);
    await expect(readFile(fixture.outputPath, 'utf8')).resolves.toBe(
      'previous output',
    );
  });

  test('applies derived Symbol geometry, component metadata, and effective instance transforms', async () => {
    const fixture = await createComponentFixture();
    const { extractMobileComponentEvidence } = await import(
      '../scripts/extract-mobile-component-evidence.mjs'
    );

    await extractMobileComponentEvidence({
      auditedRoots: { settings: ['1:1'] } as any,
      designSource: fixture.designSource,
      outputPath: fixture.outputPath,
    });

    const extracted = await loadExtractedModule(fixture.outputPath);
    expect(extracted.figmaComponentEvidence.settings.componentValues).toEqual([
      {
        guidPath: ['1:1'],
        property: 'componentProperties.state.type',
        value: 'VARIANT',
      },
      {
        guidPath: ['1:1'],
        property: 'componentProperties.state.value',
        value: 'Danger',
      },
      {
        guidPath: ['2:2'],
        property: 'componentPropertyDefinitions.state.defaultValue',
        value: 'Default',
      },
      {
        guidPath: ['2:2'],
        property: 'componentPropertyDefinitions.state.type',
        value: 'VARIANT',
      },
    ]);
    expect(extracted.figmaComponentEvidence.settings.derivedValues).toEqual([
      {
        guidPath: ['2:3'],
        property: 'fillGeometry',
        value: 'M1 1 L9 1 L9 9 L1 9 Z',
      },
      {
        guidPath: ['2:4'],
        property: 'strokeGeometry',
        value: 'M0 0 L10 0 L10 2 L0 2 Z',
      },
    ]);
    expect(extracted.figmaComponentEvidence.settings.geometry).toEqual([
      {
        fill: '#FF0000',
        fillRule: 'nonzero',
        opacity: 0.2,
        path: 'M0 0 L10 0 L10 2 L0 2 Z',
        sourceNodeId: '2:4',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        transform: 'matrix(1 0 0 1 4 5)',
      },
      {
        fill: '#FFFFFF',
        fillRule: 'nonzero',
        opacity: 0.2,
        path: 'M0 0 L10 0 L10 10 L0 10 Z',
        sourceNodeId: '2:3',
        transform: 'matrix(1 0 0 1 4 5)',
      },
    ]);
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

  test('formal source shows glassCard must bind to shell node 825:6570 while retaining former content node 825:6575', async () => {
    const document = JSON.parse(await readFile(formalDesignDocumentPath, 'utf8'));
    const nodeById = new Map(
      document.nodeChanges.map((node: any) => [
        `${node.guid.sessionID}:${node.guid.localID}`,
        node,
      ]),
    ) as Map<string, any>;

    const auditedRoot = nodeById.get('825:6575') as any;
    const actualShell = nodeById.get('825:6570') as any;

    expect(auditedRoot).toMatchObject({
      guid: { localID: 6575, sessionID: 825 },
      name: 'Container',
      size: { x: 391.54998779296875, y: 24 },
      type: 'FRAME',
    });
    expect(auditedRoot.fillPaints ?? []).toHaveLength(0);
    expect(auditedRoot.effects ?? []).toHaveLength(0);
    expect(actualShell).toMatchObject({
      cornerRadius: 24,
      guid: { localID: 6570, sessionID: 825 },
      name: 'Feed Item 3 (Full Width Featured)',
      strokeWeight: 1,
      size: { x: 441.54998779296875, y: 200.5 },
      type: 'FRAME',
    });
    expect(actualShell.fillPaints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          opacity: 0.6499999761581421,
          type: 'SOLID',
        }),
      ]),
    );
    expect(actualShell.strokePaints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          opacity: 0.4000000059604645,
          type: 'SOLID',
        }),
      ]),
    );
    expect(actualShell.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          offset: { x: 0, y: 8 },
          radius: 32,
          type: 'DROP_SHADOW',
        }),
        expect.objectContaining({
          blurOpType: 'NORMAL',
          radius: 16,
          type: 'BACKGROUND_BLUR',
        }),
      ]),
    );
  });
});
