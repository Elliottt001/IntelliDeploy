// Uses the shared Kiwi/FIG/Symbol extractor; output is task-owned and portable.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractMobileComponentEvidence } from '../../scripts/extract-mobile-component-evidence.mjs';

const nodeId = guid => `${guid.sessionID}:${guid.localID}`;

export function auditProductFrames(nodeChanges) {
  const nodes = new Map(nodeChanges.map(node => [nodeId(node.guid), node]));
  const children = new Map();
  for (const node of nodeChanges) {
    if (!node.parentIndex?.guid) continue;
    const parent = nodeId(node.parentIndex.guid);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(nodeId(node.guid));
  }
  return ['168:6299', '380:147'].map(sourceNodeId => {
    if (nodes.get(sourceNodeId)?.type !== 'FRAME') throw new Error(`Missing formal frame ${sourceNodeId}`);
    const subtree = new Set([sourceNodeId]);
    for (const current of subtree) for (const child of children.get(current) ?? []) subtree.add(child);
    const instanceCount = [...subtree].filter(key => nodes.get(key).type === 'INSTANCE').length;
    const symbolCount = [...subtree].filter(key => nodes.get(key).type === 'SYMBOL').length;
    if (instanceCount || symbolCount) throw new Error(`Formal frame ${sourceNodeId} contains Instance/Symbol descendants; resolve their sources before regeneration`);
    return { sourceNodeId, nodeCount: subtree.size, instanceCount, noSymbolReason: 'no-instance-or-symbol-in-audited-subtree' };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
const designSource = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
if (!designSource) throw new Error('Set INTELLIDEPLOY_FIGMA_SOURCE to the full local Figma package');
const temporary = await mkdtemp(path.join(tmpdir(), 'product-folder-'));
try {
  const outputPath = path.join(temporary, 'evidence.ts');
  await extractMobileComponentEvidence({ designSource, outputPath, auditedRoots: { products: ['280:26959'], back: ['380:190'], share: ['380:196'], send: ['280:26962'] }, iconRoots: {} });
  const module = await readFile(outputPath, 'utf8');
  const primitives = JSON.parse(module.match(/export const figmaComponentEvidence = ([\s\S]*?) as const satisfies/)[1]);
  const document = JSON.parse(await readFile(path.join(designSource, 'design-data/document.kiwi.json'), 'utf8'));
  const nodes = new Map(document.nodeChanges.map(node => [nodeId(node.guid), node]));
  // Text has no reusable Symbol. Preserve actual glyph outlines, avoiding font replacement.
  function glyphPath(blobIndex) {
    const bytes = Buffer.from(document.blobs[blobIndex].bytes.data, 'base64');
    let offset = 0; const commands = [];
    while (offset < bytes.length) {
      const opcode = bytes[offset++];
      const letter = { 0: 'Z', 1: 'M', 2: 'L', 3: 'Q', 4: 'C' }[opcode];
      if (!letter) throw new Error(`Unsupported glyph opcode ${opcode}`);
      const count = opcode === 0 ? 0 : opcode === 4 ? 6 : opcode === 3 ? 4 : 2;
      const values = Array.from({ length: count }, () => { const value = bytes.readFloatLE(offset); offset += 4; return Number(value.toFixed(6)); });
      commands.push(`${letter}${values.join(' ')}`);
    }
    // Figma glyph blobs start with a close sentinel; SVG paths must start at the first move.
    return commands.join(' ').replace(/^(?:Z\s*)+/, '');
  }
  function textEvidence(sourceNodeId) {
    const node = nodes.get(sourceNodeId);
    const colorHex = color => `#${[color.r, color.g, color.b].map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    return { sourceNodeId, characters: node.textData.characters, characterStyleIDs: node.textData.characterStyleIDs ?? [], styleOverrideTable: node.textData.styleOverrideTable ?? [], size: node.size, fontName: node.fontName, fontSize: node.fontSize, lineHeight: node.lineHeight, fillPaints: node.fillPaints, effects: node.effects ?? [], glyphs: node.derivedTextData.glyphs.map(glyph => {
      const styleId = node.textData.characterStyleIDs?.[glyph.firstCharacter] ?? 0;
      const override = node.textData.styleOverrideTable?.find(style => style.styleID === styleId);
      const fillPaints = override?.fillPaints ?? node.fillPaints;
      const paint = fillPaints.find(paint => paint.visible !== false);
      return { path: glyphPath(glyph.commandsBlob), position: glyph.position, fontSize: glyph.fontSize, firstCharacter: glyph.firstCharacter, styleId, fill: paint?.color ? colorHex(paint.color) : 'none', opacity: (paint?.opacity ?? 1) * (paint?.color?.a ?? 1) };
    }) };
  }
  const result = {
    frames: auditProductFrames(document.nodeChanges),
    sourceFrameWidth: nodes.get('168:6299').size.x,
    sourceFrameHeight: nodes.get('168:6299').size.y,
    rawGlassEffects: Object.fromEntries([['closed', '280:26959'], ['closedFront', '280:26962'], ['openBack', '380:190'], ['openFront', '380:196']].map(([key, sourceId]) => [key, nodes.get(sourceId).effects ?? []])),
    sourcePrototypeInteractions: Object.fromEntries([['closed', '280:26959'], ['closedFront', '280:26962'], ['openBack', '380:190'], ['openFront', '380:196']].map(([key, sourceId]) => [key, nodes.get(sourceId).prototypeInteractions ?? []])),
    closed: primitives.products, closedFront: primitives.send, openBack: primitives.back, openFront: primitives.share,
    closedBackTransform: nodes.get('280:26959').transform,
    closedFrontTransform: nodes.get('280:26962').transform,
    openBackTransform: nodes.get('380:190').transform,
    openFrontTransform: nodes.get('380:196').transform,
    header: { sourceNodeIds: ['825:5827', '825:5848'], size: nodes.get('825:5848').size },
    collection: textEvidence('825:5846'), slogan: textEvidence('280:26963'),
    closedPreviewSlots: ['380:138', '380:139', '380:141', '380:143', '380:145'].map(sourceNodeId => { const node = nodes.get(sourceNodeId); return { sourceNodeId, size: node.size, transform: node.transform, cornerRadius: node.cornerRadius }; }),
    previewSlots: ['380:191', '380:192', '380:193', '380:194', '380:195'].map(sourceNodeId => { const node = nodes.get(sourceNodeId); return { sourceNodeId, size: node.size, transform: node.transform, cornerRadius: node.cornerRadius }; }),
  };
  const destination = path.join(path.dirname(fileURLToPath(import.meta.url)), 'productFolderEvidence.ts');
  await writeFile(destination, `// Generated from formal Kiwi nodes via extractProductFolderEvidence.mjs. No source imagery.\nexport const productFolderEvidence = ${JSON.stringify(result, null, 2)} as const;\n`);
  console.log('Extracted actual custom folder paths, paints, GLASS effects, glyphs and open geometry.');
} finally { await rm(temporary, { recursive: true, force: true }); }

}
