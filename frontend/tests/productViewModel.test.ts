import { expect, test } from 'vitest';
import { type components } from '@intellideploy/api-client';
import { getAppStatusLabel, partitionApps, parseLibraryKind } from '../features/products/productViewModel';

type App = components['schemas']['AppSummary'];
const app = (id: string, extra: Partial<App> = {}): App => ({ id, name: id, updated_at: '', source_version_id: null, active_job_id: null, instance_status: null, ...extra });

test('partition uses only source_version_id and retains API order and references', () => {
  const created = app('created', { instance_status: 'RUNNING' });
  const copy = app('copy', { source_version_id: 'v1', active_job_id: 'j' });
  const blankSource = app('blank', { source_version_id: '' });
  const later = app('later', { updated_at: '2000-01-01', source_version_id: 'v2' });
  expect(partitionApps([copy, created, later, blankSource])).toEqual({ created: [created, blankSource], copies: [copy, later] });
  expect(partitionApps([copy]).copies[0]).toBe(copy);
  expect(getAppStatusLabel(copy)).toBe('正在处理需求');
});

test('empty folders never acquire sample applications', () => {
  expect(partitionApps([])).toEqual({ created: [], copies: [] });
});

test('status precedence follows the active Job pointer and every real instance status', () => {
  expect(getAppStatusLabel(app('active', { active_job_id: 'job', instance_status: 'FAILED' }))).toBe('正在处理需求');
  expect(getAppStatusLabel(app('running', { instance_status: 'RUNNING' }))).toBe('应用正在运行');
  expect(getAppStatusLabel(app('stopped', { instance_status: 'STOPPED' }))).toBe('应用已停止，数据仍保留');
  expect(getAppStatusLabel(app('failed', { instance_status: 'FAILED' }))).toBe('应用暂不可用');
  expect(getAppStatusLabel(app('pending', { instance_status: 'PENDING' }))).toBe('查看状态与结果');
  expect(getAppStatusLabel(app('unknown'))).toBe('查看状态与结果');
});

test('library kind parser accepts only exact scalar favorites/recent', () => {
  expect(parseLibraryKind('favorites')).toBe('favorites');
  expect(parseLibraryKind('recent')).toBe('recent');
  for (const value of ['FAVORITES', '/favorites', 'favorites?next=//evil', undefined, ['favorites'], ['recent', 'favorites']]) expect(parseLibraryKind(value)).toBe('recent');
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { productFolderEvidence } from '../features/products/productFolderEvidence';

test('audited folder keeps formal custom shape, no invented stroke and independent open geometry', () => {
  const { closed, openBack, openFront } = productFolderEvidence;
  expect(closed.size).toEqual({ width: 260, height: 185 });
  expect(closed.sourceNodeIds).toContain('280:26959');
  expect(closed.noSymbolReason).toBe('no-instance-or-symbol-in-audited-subtree');
  expect(closed.geometry[0].path).toContain('C');
  expect(closed.geometry[0].paint?.gradientStops?.map(stop => stop.color)).toEqual(['#7C62FF', '#C05CF6']);
  expect(closed.surfaceStrokes).toEqual([]);
  expect(openBack.geometry[0].path).toBe(closed.geometry[0].path);
  expect(openFront.geometry[0].path).not.toBe(closed.geometry[0].path);
  expect(openFront.surfaceFills[0].opacity).toBeCloseTo(0.1);
  expect(productFolderEvidence.closedFront.sourceNodeIds).toContain('280:26962');
  expect(productFolderEvidence.closedFrontTransform.m12 - 255).toBe(55);
  expect(productFolderEvidence.rawGlassEffects.closed[0].bevelSize).toBe(1);
  expect(productFolderEvidence.slogan.glyphs[3].fill).toBe('#EC3EDD');
  expect(productFolderEvidence.slogan.glyphs[0].fill).toBe('#FFFFFF');
  expect(productFolderEvidence.collection.glyphs[0].path).toMatch(/^M/);
  expect(productFolderEvidence.slogan.glyphs.filter(glyph => glyph.path).every(glyph => glyph.path.startsWith('M'))).toBe(true);
});

const designSource = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
test.skipIf(!designSource)('actual Figma source independently confirms paths, paints, effects, text, mobile trees and original FIG', () => {
  const document = JSON.parse(readFileSync(join(designSource!, 'design-data/document.kiwi.json'), 'utf8'));
  const mobile = JSON.parse(readFileSync(join(designSource!, 'design-data/移动端UI.nodes.json'), 'utf8'));
  const id = (guid: { sessionID: number; localID: number }) => `${guid.sessionID}:${guid.localID}`;
  const nodes = new Map<string, any>(document.nodeChanges.map((node: any) => [id(node.guid), node]));
  expect(readFileSync(join(designSource!, 'original/IntelliDeploy.fig')).subarray(0, 4).toString('hex')).toBe('504b0304');
  for (const frame of ['168:6299', '380:147']) {
    const subtree = new Set([frame]);
    let count = 0;
    while (subtree.size !== count) {
      count = subtree.size;
      for (const node of nodes.values()) if (node.parentIndex?.guid && subtree.has(id(node.parentIndex.guid))) subtree.add(id(node.guid));
    }
    expect(subtree.size).toBe(31);
    expect([...subtree].filter(key => ['INSTANCE', 'SYMBOL'].includes(nodes.get(key).type))).toEqual([]);
    expect(mobile.nodes.find((node: any) => id(node.guid) === frame).size).toEqual({ x: 375, y: 812 });
  }
  // Independently decode binary commands into their numerical operands; no extractor import.
  const operands = (buffer: Buffer) => {
    const result: Array<[number, number[]]> = [];
    for (let offset = 0; offset < buffer.length;) {
      const command = buffer[offset++]; const size = command === 0 ? 0 : command === 4 ? 6 : command === 3 ? 4 : 2;
      expect([0, 1, 2, 3, 4]).toContain(command);
      const values = Array.from({ length: size }, () => { const value = buffer.readFloatLE(offset); offset += 4; return value; });
      result.push([command, values]);
    }
    return result;
  };
  for (const [key, sourceId] of [['closed', '280:26959'], ['closedFront', '280:26962'], ['openBack', '380:190'], ['openFront', '380:196']] as const) {
    const source = nodes.get(sourceId); const evidence = productFolderEvidence[key];
    expect(productFolderEvidence.rawGlassEffects[key]).toEqual(source.effects);
    expect(productFolderEvidence.sourcePrototypeInteractions[key]).toEqual(source.prototypeInteractions ?? []);
    const sourceCommands = operands(Buffer.from(document.blobs[source.fillGeometry[0].commandsBlob].bytes.data, 'base64'));
    const recorded = evidence.geometry[0].path.match(/[MLCZ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!;
    const numeric = recorded.filter(value => !/^[MLCZ]$/i.test(value)).map(Number);
    expect(numeric).toHaveLength(sourceCommands.flatMap(command => command[1]).length);
    sourceCommands.flatMap(command => command[1]).forEach((value, index) => expect(numeric[index]).toBeCloseTo(value, 5));
    expect(recorded.filter(value => /^[MLCZ]$/i.test(value))).toEqual(sourceCommands.map(command => ({ 0: 'Z', 1: 'M', 2: 'L', 4: 'C' })[command[0] as 0|1|2|4]));
    expect(evidence.size).toEqual({ width: source.size.x, height: source.size.y });
    expect(source.strokePaints ?? []).toEqual([]);
    expect(evidence.surfaceEffects[0].rawType).toBe(source.effects[0].type);
    expect(evidence.surfaceEffects[0].radius).toBe(source.effects[0].radius);
    expect(evidence.surfaceEffects[0].refractionRadius).toBe(source.effects[0].refractionRadius);
    expect(evidence.surfaceEffects[0].seed).toBe(source.effects[0].seed);
  }
  for (const [key, sourceId] of [['collection', '825:5846'], ['slogan', '280:26963']] as const) {
    const source = nodes.get(sourceId); const recorded = productFolderEvidence[key];
    expect(recorded.fontName).toEqual(source.fontName);
    expect(recorded.fontSize).toBe(source.fontSize);
    expect(recorded.characters).toBe(source.textData.characters);
    expect(recorded.glyphs).toHaveLength(source.derivedTextData.glyphs.length);
    source.derivedTextData.glyphs.forEach((glyph: any, index: number) => {
      expect(recorded.glyphs[index].position).toEqual(glyph.position);
      const styleId = source.textData.characterStyleIDs?.[glyph.firstCharacter] ?? 0;
      const override = source.textData.styleOverrideTable?.find((entry: any) => entry.styleID === styleId);
      const paint = (override?.fillPaints ?? source.fillPaints).find((entry: any) => entry.visible !== false);
      const expectedColor = `#${[paint.color.r, paint.color.g, paint.color.b].map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
      expect(recorded.glyphs[index].fill).toBe(expectedColor);
      expect(recorded.glyphs[index].styleId).toBe(styleId);

      const expected = operands(Buffer.from(document.blobs[glyph.commandsBlob].bytes.data, 'base64')).flatMap(command => command[1]);
      const actual = (recorded.glyphs[index].path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? []).map(Number);
      expect(actual).toHaveLength(expected.length);
      expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 5));
    });
  }
  const folder = nodes.get('280:26959');
  const rgb = (color: any) => `#${[color.r, color.g, color.b].map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  expect(productFolderEvidence.closed.surfaceFills[0].gradientStops?.map(stop => stop.color)).toEqual(folder.fillPaints[0].stops.map((stop: any) => rgb(stop.color)));
  expect(productFolderEvidence.closed.surfaceFills[0].gradientStops?.flatMap(stop => stop.variableIds)).toEqual(['106:76525', '153:2325']);
  for (const [index, variableId] of ['106:76525', '153:2325'].entries()) {
    const variable = nodes.get(variableId);
    expect(variable.type).toBe('VARIABLE');
    expect(variable.variableResolvedType).toBe('COLOR');
    expect(productFolderEvidence.closed.surfaceFills[0].gradientStops?.[index].color).toBe(rgb(variable.variableDataValues.entries[0].variableData.value.colorValue));
  }

  expect(productFolderEvidence.openBackTransform).toEqual(nodes.get('380:190').transform);
  expect(productFolderEvidence.openFrontTransform).toEqual(nodes.get('380:196').transform);
  expect(productFolderEvidence.closedBackTransform).toEqual(nodes.get('280:26959').transform);
  expect(productFolderEvidence.sourceFrameWidth).toBe(375);
  expect(productFolderEvidence.closedPreviewSlots.map(slot => slot.sourceNodeId)).toEqual(['380:138', '380:139', '380:141', '380:143', '380:145']);
  expect(productFolderEvidence.previewSlots.map(slot => slot.sourceNodeId)).toEqual(['380:191', '380:192', '380:193', '380:194', '380:195']);
  productFolderEvidence.closedPreviewSlots.forEach((slot, index) => {
    expect(slot.size).toEqual(nodes.get(['380:138', '380:139', '380:141', '380:143', '380:145'][index]).size);
    expect(slot.transform).toEqual(nodes.get(['380:138', '380:139', '380:141', '380:143', '380:145'][index]).transform);
  });
  const openAction = productFolderEvidence.sourcePrototypeInteractions.closedFront[0].actions[0];
  const closeAction = productFolderEvidence.sourcePrototypeInteractions.openFront[0].actions[0];
  expect(closeAction.transitionDuration).toBe(openAction.transitionDuration);
  expect(closeAction.easingType).toBe(openAction.easingType);
  expect(closeAction.easingFunction).toEqual(openAction.easingFunction);
  expect(productFolderEvidence.collection.fontName).toEqual(nodes.get('825:5846').fontName);
  expect(productFolderEvidence.collection.fontSize).toBe(24);
  expect(nodes.get('825:5848').size).toEqual({ x: 334, y: 38 });
  expect(readFileSync(join(designSource!, 'design-data/frames.csv'), 'utf8')).toContain('380:147,FRAME,我的产品,375,812');
  expect(readFileSync(join(designSource!, 'design-data/text.csv'), 'utf8')).toContain('COLLECTION,PingFang SC,Heavy,24');
  expect(readFileSync(join(designSource!, 'design-data/fonts.csv'), 'utf8')).toContain('Alimama ShuHeiTi,Bold');
  expect(readFileSync(join(designSource!, 'design-data/colors.csv'), 'utf8')).toContain('#7C62FF');
  const raw = JSON.parse(readFileSync(join(designSource!, 'design-data/raw-assets.json'), 'utf8'));
  const exampleImage = nodes.get('380:192').fillPaints[0].image.hash.data;
  const imageHash = Buffer.from(exampleImage, 'base64').toString('hex');
  expect(raw.some((asset: any) => asset.archive_path.endsWith(imageHash))).toBe(true);
  const exampleAsset = raw.find((asset: any) => asset.archive_path.endsWith(imageHash));
  expect(readFileSync(join(designSource!, exampleAsset.local_path))).toHaveLength(exampleAsset.bytes);
  const neutralHash = '42811159c4b77210f20cb8dd8611c49872975bd9';
  const neutralAsset = raw.find((asset: any) => asset.archive_path.endsWith(neutralHash));
  expect(neutralAsset).toBeDefined();
  expect(readFileSync(join(designSource!, neutralAsset.local_path))).toEqual(readFileSync(join(import.meta.dirname, '../assets/mobile/generated/845-3522-' + neutralHash + '.png')));

  // Example imagery exists, but AppSummary has no icon contract: it must stay outside products runtime.
  expect(readFileSync(join(import.meta.dirname, '../features/products/ProductFolder.tsx'), 'utf8')).not.toContain(imageHash);
});

test('regeneration computes complete frame trees and rejects new Instance/Symbol descendants', async () => {
  const { auditProductFrames } = await import('../features/products/extractProductFolderEvidence.mjs');
  const node = (key: string, type: string, parent?: string) => {
    const guid = (value: string) => { const [sessionID, localID] = value.split(':').map(Number); return { sessionID, localID }; };
    return { guid: guid(key), type, ...(parent ? { parentIndex: { guid: guid(parent) } } : {}) };
  };
  const tree = [node('168:6299', 'FRAME'), node('380:147', 'FRAME'), node('1:1', 'FRAME', '168:6299'), node('1:2', 'VECTOR', '1:1'), node('1:3', 'TEXT', '380:147')];
  expect(auditProductFrames(tree)).toEqual([
    { sourceNodeId: '168:6299', nodeCount: 3, instanceCount: 0, noSymbolReason: 'no-instance-or-symbol-in-audited-subtree' },
    { sourceNodeId: '380:147', nodeCount: 2, instanceCount: 0, noSymbolReason: 'no-instance-or-symbol-in-audited-subtree' },
  ]);
  expect(auditProductFrames([...tree, node('1:4', 'VECTOR', '1:2')])[0].nodeCount).toBe(4);
  expect(() => auditProductFrames([...tree, node('1:5', 'INSTANCE', '1:2')])).toThrow(/168:6299.*Instance\/Symbol/);
  expect(() => auditProductFrames([...tree, node('1:6', 'SYMBOL', '1:3')])).toThrow(/380:147.*Instance\/Symbol/);
  expect(() => auditProductFrames(tree.filter(item => item.guid.sessionID !== 380))).toThrow(/Missing formal frame 380:147/);
});
