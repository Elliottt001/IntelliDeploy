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
  includeOddCompound = false,
  includePaintedLayers = false,
  useRotatedScaledInstance = false,
}: {
  danglingSymbol?: boolean;
  invalidSymbolTarget?: boolean;
  includeOddCompound?: boolean;
  includePaintedLayers?: boolean;
  useRotatedScaledInstance?: boolean;
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
  const instanceTransform = useRotatedScaledInstance
    ? { m00: 0, m01: -2, m02: 40, m10: 2, m11: 0, m12: 50 }
    : { m00: 1, m01: 0, m02: 4, m10: 0, m11: 1, m12: 5 };

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
        createCommandsBlob([
          [1, 0, 0],
          [2, 10, 0],
          [2, 10, 10],
          [2, 0, 10],
          0,
          [1, 3, 3],
          [2, 7, 3],
          [2, 7, 7],
          [2, 3, 7],
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
          transform: instanceTransform,
          type: 'INSTANCE',
          visible: true,
        },
        ...(danglingSymbol
          ? []
          : [
              {
                componentPropDefs: [
                  {
                    id: { localID: 9, sessionID: 9 },
                    initialValue: {},
                    name: 'State',
                    preferredValues: {},
                    sortPosition: '!',
                    type: 'VARIANT',
                    varValue: {
                      dataType: 'STRING',
                      resolvedDataType: 'STRING',
                      value: { textValue: '' },
                    },
                  },
                ],
                guid: { localID: 5, sessionID: 2 },
                name: 'Settings component',
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
                type: 'FRAME',
                visible: true,
              },
              {
                guid: { localID: 2, sessionID: 2 },
                name: 'Settings symbol',
                opacity: 1,
                parentIndex: {
                  guid: { localID: 5, sessionID: 2 },
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
                variantPropSpecs: [
                  {
                    propDefId: { localID: 9, sessionID: 9 },
                    value: 'Danger',
                  },
                ],
                type: 'SYMBOL',
                visible: true,
              },
              {
                guid: { localID: 6, sessionID: 2 },
                name: 'Settings icon root',
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
                type: 'FRAME',
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
                  guid: { localID: 6, sessionID: 2 },
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
                  guid: { localID: 6, sessionID: 2 },
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
              ...(includeOddCompound
                ? [
                    {
                      fillGeometry: [
                        { commandsBlob: 3, styleID: 0, windingRule: 'ODD' },
                      ],
                      fillPaints: [
                        {
                          authoredColor: {
                            c0: 0,
                            c1: 1,
                            c2: 0,
                            c3: 1,
                            space: 'DEFAULT',
                          },
                          blendMode: 'NORMAL',
                          color: { a: 1, b: 0, g: 1, r: 0 },
                          opacity: 1,
                          type: 'SOLID',
                          visible: true,
                        },
                      ],
                      guid: { localID: 7, sessionID: 2 },
                      name: 'Odd fill',
                      opacity: 1,
                      parentIndex: {
                        guid: { localID: 6, sessionID: 2 },
                        position: '#',
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
                      type: 'BOOLEAN_OPERATION',
                      visible: true,
                    },
                  ]
                : []),
              ...(includePaintedLayers
                ? [
                    {
                      fillGeometry: [
                        { commandsBlob: 0, styleID: 0, windingRule: 'NONZERO' },
                      ],
                      fillPaints: [
                        {
                          authoredStops: [
                            {
                              authoredColor: {
                                c0: 1,
                                c1: 0,
                                c2: 0,
                                c3: 0.5,
                                space: 'DEFAULT',
                              },
                              position: 0,
                            },
                            {
                              authoredColor: {
                                c0: 0,
                                c1: 0,
                                c2: 1,
                                c3: 0.75,
                                space: 'DEFAULT',
                              },
                              position: 1,
                            },
                          ],
                          blendMode: 'NORMAL',
                          interpolationColorSpace: 'DEFAULT',
                          interpolationHueMethod: 'INCREASING',
                          opacity: 0.6,
                          stops: [
                            {
                              color: { a: 0.5, b: 0, g: 0, r: 1 },
                              position: 0,
                            },
                            {
                              color: { a: 0.75, b: 1, g: 0, r: 0 },
                              position: 1,
                            },
                          ],
                          transform: {
                            m00: 1,
                            m01: 0,
                            m02: 0.1,
                            m10: 0,
                            m11: 1,
                            m12: 0.2,
                          },
                          type: 'GRADIENT_LINEAR',
                          visible: true,
                        },
                      ],
                      guid: { localID: 8, sessionID: 2 },
                      name: 'Gradient fill',
                      opacity: 1,
                      parentIndex: {
                        guid: { localID: 6, sessionID: 2 },
                        position: '$',
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
                      type: 'RECTANGLE',
                      visible: true,
                    },
                    {
                      fillGeometry: [
                        { commandsBlob: 0, styleID: 0, windingRule: 'NONZERO' },
                      ],
                      fillPaints: [
                        {
                          blendMode: 'NORMAL',
                          opacity: 1,
                          scaleMode: 'FILL',
                          transform: {
                            m00: 1,
                            m01: 0,
                            m02: 0,
                            m10: 0,
                            m11: 1,
                            m12: 0,
                          },
                          type: 'IMAGE',
                          visible: true,
                        },
                      ],
                      guid: { localID: 9, sessionID: 2 },
                      name: 'Image fill',
                      opacity: 1,
                      parentIndex: {
                        guid: { localID: 6, sessionID: 2 },
                        position: '%',
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
                      type: 'RECTANGLE',
                      visible: true,
                    },
                  ]
                : []),
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
          transform: instanceTransform,
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
        paint: {
          color: '#494A64',
          opacity: 1,
          type: 'SOLID',
          variableIds: [],
        },
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
        paint: {
          color: '#494A64',
          opacity: 1,
          type: 'SOLID',
          variableIds: [],
        },
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
        paint: {
          color: '#494A64',
          opacity: 1,
          type: 'SOLID',
          variableIds: [],
        },
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
        property: 'variantPropSpecs[9:9].value',
        value: 'Danger',
      },
      {
        guidPath: ['2:5'],
        property: 'componentPropDefs[9:9].name',
        value: 'State',
      },
      {
        guidPath: ['2:5'],
        property: 'componentPropDefs[9:9].type',
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
        paint: {
          color: '#FF0000',
          opacity: 0.5,
          type: 'SOLID',
          variableIds: [],
        },
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
        paint: {
          color: '#FFFFFF',
          opacity: 0.4,
          type: 'SOLID',
          variableIds: [],
        },
        path: 'M1 1 L9 1 L9 9 L1 9 Z',
        sourceNodeId: '2:3',
        transform: 'matrix(1 0 0 1 4 5)',
      },
    ]);
  });

  test('builds symbol-backed runtime icons from effective derived geometry instead of base symbol geometry', async () => {
    const fixture = await createComponentFixture();
    const { extractMobileComponentEvidence } = await import(
      '../scripts/extract-mobile-component-evidence.mjs'
    );

    await extractMobileComponentEvidence({
      auditedRoots: { settings: ['1:1'] } as any,
      designSource: fixture.designSource,
      iconRoots: { settings: '2:6' } as any,
      outputPath: fixture.outputPath,
    });

    const extracted = await loadExtractedModule(fixture.outputPath);
    expect(extracted.figmaMobileIcons.settings.viewBox).toBe('0 0 10 10');
    expect(extracted.figmaMobileIcons.settings.layers).toEqual([
      {
        fill: '#FF0000',
        fillRule: 'nonzero',
        opacity: 0.2,
        paint: {
          color: '#FF0000',
          opacity: 0.5,
          type: 'SOLID',
          variableIds: [],
        },
        path: 'M0 0 L10 0 L10 2 L0 2 Z',
        sourceNodeId: '2:4',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      {
        fill: '#FFFFFF',
        fillRule: 'nonzero',
        opacity: 0.2,
        paint: {
          color: '#FFFFFF',
          opacity: 0.4,
          type: 'SOLID',
          variableIds: [],
        },
        path: 'M1 1 L9 1 L9 9 L1 9 Z',
        sourceNodeId: '2:3',
      },
    ]);
  });

  test('keeps rotated and scaled effective icon geometry visible after removing canvas placement', async () => {
    const fixture = await createComponentFixture({ useRotatedScaledInstance: true });
    const { extractMobileComponentEvidence } = await import(
      '../scripts/extract-mobile-component-evidence.mjs'
    );

    await extractMobileComponentEvidence({
      auditedRoots: { settings: ['1:1'] } as any,
      designSource: fixture.designSource,
      iconRoots: { settings: '2:6' } as any,
      outputPath: fixture.outputPath,
    });

    const extracted = await loadExtractedModule(fixture.outputPath);
    const icon = extracted.figmaMobileIcons.settings;
    const [viewportX, viewportY, viewportWidth, viewportHeight] = icon.viewBox
      .split(' ')
      .map(Number);
    const transformedBounds = icon.layers.map((layer: { path: string; transform: string }) => {
      const [a, b, c, d, e, f] = layer.transform
        .slice('matrix('.length, -1)
        .split(' ')
        .map(Number);
      // This fixture contains straight polygons: read its emitted vertices and
      // apply SVG's affine matrix independently of the extractor's helpers.
      const vertices = [...layer.path.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
        .map(([, x, y]) => ({
          x: a * Number(x) + c * Number(y) + e,
          y: b * Number(x) + d * Number(y) + f,
        }));
      const bounds = {
        minX: Math.min(...vertices.map((vertex) => vertex.x)),
        maxX: Math.max(...vertices.map((vertex) => vertex.x)),
        minY: Math.min(...vertices.map((vertex) => vertex.y)),
        maxY: Math.max(...vertices.map((vertex) => vertex.y)),
      };
      expect(bounds.minX).toBeGreaterThanOrEqual(viewportX);
      expect(bounds.maxX).toBeLessThanOrEqual(viewportX + viewportWidth);
      expect(bounds.minY).toBeGreaterThanOrEqual(viewportY);
      expect(bounds.maxY).toBeLessThanOrEqual(viewportY + viewportHeight);
      return bounds;
    });
    expect(transformedBounds).toEqual([
      { minX: -4, maxX: 0, minY: 0, maxY: 20 },
      { minX: -18, maxX: -2, minY: 2, maxY: 18 },
    ]);
    expect(icon.viewBox).toBe('-20 0 20 20');
    expect(extracted.figmaMobileIcons.settings.layers).toEqual([
      {
        fill: '#FF0000',
        fillRule: 'nonzero',
        opacity: 0.2,
        paint: {
          color: '#FF0000',
          opacity: 0.5,
          type: 'SOLID',
          variableIds: [],
        },
        path: 'M0 0 L10 0 L10 2 L0 2 Z',
        sourceNodeId: '2:4',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        transform: 'matrix(0 2 -2 0 0 0)',
      },
      {
        fill: '#FFFFFF',
        fillRule: 'nonzero',
        opacity: 0.2,
        paint: {
          color: '#FFFFFF',
          opacity: 0.4,
          type: 'SOLID',
          variableIds: [],
        },
        path: 'M1 1 L9 1 L9 9 L1 9 Z',
        sourceNodeId: '2:3',
        transform: 'matrix(0 2 -2 0 0 0)',
      },
    ]);
  });

  test('maps Kiwi ODD winding rules to SVG evenodd in controlled extracted layers', async () => {
    const fixture = await createComponentFixture({ includeOddCompound: true });
    const { extractMobileComponentEvidence } = await import(
      '../scripts/extract-mobile-component-evidence.mjs'
    );

    await extractMobileComponentEvidence({
      auditedRoots: { settings: ['1:1'] } as any,
      designSource: fixture.designSource,
      iconRoots: { settings: '2:6' } as any,
      outputPath: fixture.outputPath,
    });

    const extracted = await loadExtractedModule(fixture.outputPath);
    expect(extracted.figmaMobileIcons.settings.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fillRule: 'evenodd',
          path: 'M0 0 L10 0 L10 10 L0 10 Z M3 3 L7 3 L7 7 L3 7 Z',
          sourceNodeId: '2:7',
        }),
      ]),
    );
  });

  test('preserves gradient and image-painted geometry layers instead of dropping them silently', async () => {
    const fixture = await createComponentFixture({ includePaintedLayers: true });
    const { extractMobileComponentEvidence } = await import(
      '../scripts/extract-mobile-component-evidence.mjs'
    );

    await extractMobileComponentEvidence({
      auditedRoots: { settings: ['1:1'] } as any,
      designSource: fixture.designSource,
      iconRoots: { settings: '2:6' } as any,
      outputPath: fixture.outputPath,
    });

    const extracted = await loadExtractedModule(fixture.outputPath);
    expect(extracted.figmaMobileIcons.settings.layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paint: expect.objectContaining({
            gradientStops: [
              expect.objectContaining({
                color: '#FF0000',
                opacity: 0.5,
                position: 0,
              }),
              expect.objectContaining({
                color: '#0000FF',
                opacity: 0.75,
                position: 1,
              }),
            ],
            opacity: 0.6,
            start: { x: 0.1, y: 0.2 },
            end: { x: 1.1, y: 0.2 },
            type: 'GRADIENT_LINEAR',
          }),
          sourceNodeId: '2:8',
        }),
        expect.objectContaining({
          paint: expect.objectContaining({
            opacity: 1,
            type: 'IMAGE',
          }),
          sourceNodeId: '2:9',
        }),
      ]),
    );
  });

  test('actual settings provenance records formal componentPropDefs and variantPropSpecs', () => {
    expect(figmaComponentEvidence.settings.componentValues).toEqual(
      expect.arrayContaining([
        {
          guidPath: ['248:20539'],
          property: 'componentPropDefs[3042298610:1086140708].name',
          value: 'Property 1',
        },
        {
          guidPath: ['248:20539'],
          property: 'componentPropDefs[3042298610:1086140708].type',
          value: 'VARIANT',
        },
        {
          guidPath: ['248:20538'],
          property: 'variantPropSpecs[3042298610:1086140708].value',
          value: 'Default',
        },
      ]),
    );
  });

  test('actual audited nodes preserve evenodd fill rules and gradient-backed geometry evidence', () => {
    expect(getFigmaMobileIcon('share').layers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fillRule: 'evenodd',
          sourceNodeId: '845:3513',
        }),
      ]),
    );
    expect(figmaComponentEvidence.send.geometry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fillRule: 'evenodd',
          sourceNodeId: '845:3540',
        }),
      ]),
    );
    expect(figmaComponentEvidence.glassCard.geometry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paint: expect.objectContaining({
            gradientStops: [
              expect.objectContaining({
                color: '#7C62FF',
                position: 0,
              }),
              expect.objectContaining({
                color: '#C05CF6',
                position: 1,
              }),
            ],
            type: 'GRADIENT_LINEAR',
          }),
          sourceNodeId: '825:6576',
        }),
      ]),
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
