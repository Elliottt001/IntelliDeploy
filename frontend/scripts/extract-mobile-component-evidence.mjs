import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const defaultDesignSource =
  '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221';

export const auditedRoots = {
  settings: ['266:21480'],
  brandMark: ['270:26268', '270:26277'],
  back: ['845:3503', '845:3505'],
  share: ['845:3510', '845:3512'],
  search: ['270:26625'],
  bell: ['825:6482'],
  microphone: ['845:3535'],
  send: ['845:3539'],
  arrowRight: ['825:7024'],
  home: ['270:26532', '270:26534'],
  store: ['270:26538', '270:26540'],
  community: ['270:26546', '270:26548'],
  products: ['270:26552', '270:26554'],
  circleAction: ['845:3503', '845:3510'],
  bottomNav: ['270:26531'],
  glassCard: ['825:6575'],
};

const primitiveOrder = [
  'settings',
  'back',
  'share',
  'search',
  'bell',
  'microphone',
  'send',
  'arrowRight',
  'home',
  'store',
  'community',
  'products',
  'brandMark',
  'circleAction',
  'bottomNav',
  'glassCard',
];

const iconPrimitiveMap = {
  settings: 'settings',
  back: 'back',
  share: 'share',
  search: 'search',
  bell: 'bell',
  microphone: 'microphone',
  send: 'send',
  'arrow-right': 'arrowRight',
  house: 'home',
  'layout-grid': 'store',
  compass: 'community',
  user: 'products',
};

const iconGeometryTypes = new Set(['BOOLEAN_OPERATION', 'LINE', 'VECTOR']);
const geometryNodeTypes = new Set([
  'BOOLEAN_OPERATION',
  'ELLIPSE',
  'FRAME',
  'LINE',
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'VECTOR',
]);

function nodeId(guid) {
  return `${guid.sessionID}:${guid.localID}`;
}

function compareNodeIds(left, right) {
  const [leftSession, leftLocal] = left.split(':').map(Number);
  const [rightSession, rightLocal] = right.split(':').map(Number);
  return leftSession - rightSession || leftLocal - rightLocal;
}

function comparePositions(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function formatNumber(value) {
  if (Math.abs(value) < 1e-6) {
    return '0';
  }
  return Number(value.toFixed(3)).toString();
}

function identityMatrix() {
  return { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
}

function multiplyTransforms(left, right) {
  return {
    m00: left.m00 * right.m00 + left.m01 * right.m10,
    m01: left.m00 * right.m01 + left.m01 * right.m11,
    m02: left.m00 * right.m02 + left.m01 * right.m12 + left.m02,
    m10: left.m10 * right.m00 + left.m11 * right.m10,
    m11: left.m10 * right.m01 + left.m11 * right.m11,
    m12: left.m10 * right.m02 + left.m11 * right.m12 + left.m12,
  };
}

function isIdentityTransform(transform) {
  return (
    Math.abs(transform.m00 - 1) < 1e-6 &&
    Math.abs(transform.m01) < 1e-6 &&
    Math.abs(transform.m02) < 1e-6 &&
    Math.abs(transform.m10) < 1e-6 &&
    Math.abs(transform.m11 - 1) < 1e-6 &&
    Math.abs(transform.m12) < 1e-6
  );
}

function toSvgMatrix(transform) {
  return `matrix(${[
    formatNumber(transform.m00),
    formatNumber(transform.m10),
    formatNumber(transform.m01),
    formatNumber(transform.m11),
    formatNumber(transform.m02),
    formatNumber(transform.m12),
  ].join(' ')})`;
}

function colorToHex(color) {
  if (!color) {
    return undefined;
  }
  const channel = (value) =>
    Math.max(0, Math.min(255, Math.round((value ?? 0) * 255)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function variableIdsFromPaint(paint) {
  const ids = [];
  for (const value of Object.values(paint ?? {})) {
    const guid = value?.value?.alias?.guid ?? value?.guid;
    if (guid?.sessionID != null && guid?.localID != null) {
      ids.push(nodeId(guid));
    }
  }
  return [...new Set(ids)].sort(compareNodeIds);
}

function normalizePaint(paint) {
  if (!paint) {
    return null;
  }
  return {
    color: colorToHex(paint.color ?? paint.authoredColor),
    opacity: Number((paint.opacity ?? paint.color?.a ?? 1).toFixed(6)),
    styleId:
      paint.styleId?.guid != null ? nodeId(paint.styleId.guid) : undefined,
    type: paint.type,
    variableIds: variableIdsFromPaint(paint),
  };
}

function normalizeEffect(effect) {
  if (!effect) {
    return null;
  }
  const typeMap = {
    BACKGROUND_BLUR: 'BACKGROUND_BLUR',
    DROP_SHADOW: 'DROP_SHADOW',
    GLASS: 'BACKGROUND_BLUR',
    INNER_SHADOW: 'INNER_SHADOW',
    LAYER_BLUR: 'LAYER_BLUR',
  };
  return {
    color: colorToHex(effect.color ?? effect.authoredColor),
    offset:
      effect.offset == null
        ? undefined
        : {
            x: Number((effect.offset.x ?? 0).toFixed(6)),
            y: Number((effect.offset.y ?? 0).toFixed(6)),
          },
    radius: Number((effect.radius ?? 0).toFixed(6)),
    styleId:
      effect.styleId?.guid != null ? nodeId(effect.styleId.guid) : undefined,
    type: typeMap[effect.type] ?? 'DROP_SHADOW',
  };
}

function flattenOverrideValue(value) {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return JSON.stringify(value);
}

function collectOverrideEntries(overrides = []) {
  const entries = [];
  for (const override of overrides) {
    const guidPath = (override.guidPath?.guids ?? []).map(nodeId);
    for (const [property, value] of Object.entries(override)) {
      if (property === 'guidPath') {
        continue;
      }
      entries.push({
        guidPath,
        property,
        value: flattenOverrideValue(value),
      });
    }
  }
  return entries.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right), 'en'),
  );
}

function parseCommandsBlob(blob) {
  const buffer = Buffer.from(blob.bytes.data, 'base64');
  const commands = [];
  let offset = 0;
  while (offset < buffer.length) {
    const opcode = buffer.readUInt8(offset);
    offset += 1;
    if (opcode === 0x00) {
      commands.push({ type: 'Z' });
      continue;
    }
    const readFloat = () => {
      const value = buffer.readFloatLE(offset);
      offset += 4;
      return value;
    };
    if (opcode === 0x01) {
      commands.push({ type: 'M', x: readFloat(), y: readFloat() });
      continue;
    }
    if (opcode === 0x02) {
      commands.push({ type: 'L', x: readFloat(), y: readFloat() });
      continue;
    }
    if (opcode === 0x04) {
      commands.push({
        c1x: readFloat(),
        c1y: readFloat(),
        c2x: readFloat(),
        c2y: readFloat(),
        type: 'C',
        x: readFloat(),
        y: readFloat(),
      });
      continue;
    }
    throw new Error(`Unsupported commandsBlob opcode 0x${opcode.toString(16)}`);
  }
  return commands
    .map((command) => {
      if (command.type === 'Z') {
        return 'Z';
      }
      if (command.type === 'M' || command.type === 'L') {
        return `${command.type}${formatNumber(command.x)} ${formatNumber(command.y)}`;
      }
      return `C${formatNumber(command.c1x)} ${formatNumber(command.c1y)} ${formatNumber(command.c2x)} ${formatNumber(command.c2y)} ${formatNumber(command.x)} ${formatNumber(command.y)}`;
    })
    .join(' ');
}

function firstVisibleColor(paints, preferred = 'fill') {
  for (const paint of paints ?? []) {
    if (paint?.visible === false) {
      continue;
    }
    const color = colorToHex(paint.color ?? paint.authoredColor);
    if (color) {
      return color;
    }
  }
  return preferred === 'fill' ? undefined : undefined;
}

function strokeLinecapFor(node) {
  if (node.strokeCap === 'ROUND') {
    return 'round';
  }
  if (node.strokeCap === 'SQUARE') {
    return 'square';
  }
  return 'butt';
}

function strokeLinejoinFor(node) {
  if (node.strokeJoin === 'BEVEL') {
    return 'bevel';
  }
  if (node.strokeJoin === 'ROUND') {
    return 'round';
  }
  return 'miter';
}

function sortByJson(values) {
  return values.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right), 'en'),
  );
}

function stableSerialize(value, indent = 0) {
  const padding = '  '.repeat(indent);
  const childPadding = '  '.repeat(indent + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    return `[\n${value
      .map((item) => `${childPadding}${stableSerialize(item, indent + 1)}`)
      .join(',\n')}\n${padding}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
    if (entries.length === 0) {
      return '{}';
    }
    return `{\n${entries
      .map(
        ([key, entry]) =>
          `${childPadding}${JSON.stringify(key)}: ${stableSerialize(entry, indent + 1)}`,
      )
      .join(',\n')}\n${padding}}`;
  }
  return JSON.stringify(value);
}

function createNodeMaps(documentNodes, mobileNodes) {
  const documentNodeById = new Map(documentNodes.map((node) => [nodeId(node.guid), node]));
  const mobileNodeById = new Map(mobileNodes.map((node) => [nodeId(node.guid), node]));
  const childIdsByParent = new Map();

  for (const node of documentNodes) {
    const parentGuid = node.parentIndex?.guid;
    if (!parentGuid) {
      continue;
    }
    const parent = nodeId(parentGuid);
    childIdsByParent.set(parent, [...(childIdsByParent.get(parent) ?? []), nodeId(node.guid)]);
  }

  for (const [parent, childIds] of childIdsByParent) {
    childIds.sort((left, right) =>
      comparePositions(
        documentNodeById.get(left)?.parentIndex?.position,
        documentNodeById.get(right)?.parentIndex?.position,
      ),
    );
    childIdsByParent.set(parent, childIds);
  }

  return { childIdsByParent, documentNodeById, mobileNodeById };
}

function collectSubtree(rootId, maps, predicate) {
  const collected = [];
  const root = maps.documentNodeById.get(rootId);
  if (!root) {
    throw new Error(`Missing audited root ${rootId}`);
  }

  const visit = (currentId, transform) => {
    const node = maps.documentNodeById.get(currentId);
    if (!node) {
      return;
    }
    if (predicate(node)) {
      collected.push({ node, transform });
    }
    for (const childId of maps.childIdsByParent.get(currentId) ?? []) {
      const child = maps.documentNodeById.get(childId);
      const childTransform = multiplyTransforms(
        transform,
        child?.transform ?? identityMatrix(),
      );
      visit(childId, childTransform);
    }
  };

  visit(rootId, identityMatrix());
  return collected;
}

function collectStyleEvidence(rootId, maps) {
  const subtree = collectSubtree(rootId, maps, () => true);
  const fills = [];
  const strokes = [];
  const effects = [];
  for (const { node } of subtree) {
    for (const paint of node.fillPaints ?? []) {
      const normalized = normalizePaint(paint);
      if (normalized) {
        fills.push(normalized);
      }
    }
    for (const paint of node.strokePaints ?? []) {
      const normalized = normalizePaint(paint);
      if (normalized) {
        strokes.push(normalized);
      }
    }
    for (const effect of node.effects ?? []) {
      const normalized = normalizeEffect(effect);
      if (normalized) {
        effects.push(normalized);
      }
    }
  }
  return {
    effects: sortByJson(effects),
    fills: sortByJson(fills),
    strokes: sortByJson(strokes),
  };
}

function geometryLayersFromEntries(entries, blobs) {
  const layers = [];
  for (const { node, transform } of entries) {
    for (const geometry of node.fillGeometry ?? []) {
      const blob = blobs[geometry.commandsBlob];
      if (!blob) {
        throw new Error(`Missing geometry blob ${geometry.commandsBlob} for ${nodeId(node.guid)}`);
      }
      layers.push({
        fill: firstVisibleColor(node.fillPaints, 'fill'),
        opacity: Number((node.opacity ?? 1).toFixed(6)),
        path: parseCommandsBlob(blob),
        sourceNodeId: nodeId(node.guid),
        stroke: undefined,
        strokeLinecap: undefined,
        strokeLinejoin: undefined,
        strokeWidth: undefined,
        transform: isIdentityTransform(transform)
          ? undefined
          : toSvgMatrix(transform),
      });
    }
    for (const geometry of node.strokeGeometry ?? []) {
      const blob = blobs[geometry.commandsBlob];
      if (!blob) {
        throw new Error(`Missing geometry blob ${geometry.commandsBlob} for ${nodeId(node.guid)}`);
      }
      layers.push({
        fill: undefined,
        opacity: Number((node.opacity ?? 1).toFixed(6)),
        path: parseCommandsBlob(blob),
        sourceNodeId: nodeId(node.guid),
        stroke: firstVisibleColor(node.strokePaints, 'stroke'),
        strokeLinecap: strokeLinecapFor(node),
        strokeLinejoin: strokeLinejoinFor(node),
        strokeWidth:
          node.strokeWeight == null ? undefined : Number(node.strokeWeight.toFixed(6)),
        transform: isIdentityTransform(transform)
          ? undefined
          : toSvgMatrix(transform),
      });
    }
  }
  return layers.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right), 'en'),
  );
}

function canonicalVisualRootId(key, rootIds, maps) {
  const rootId = rootIds[0];
  if (key !== 'bottomNav') {
    return rootId;
  }
  const parentGuid = maps.documentNodeById.get(rootId)?.parentIndex?.guid;
  if (!parentGuid) {
    return rootId;
  }
  const parentId = nodeId(parentGuid);
  return maps.documentNodeById.has(parentId) ? parentId : rootId;
}

function extractNodePrimitive(key, rootIds, maps, blobs) {
  const canonicalRootId = canonicalVisualRootId(key, rootIds, maps);
  const canonicalRoot = maps.documentNodeById.get(canonicalRootId);
  if (!canonicalRoot) {
    throw new Error(`Missing canonical audited root ${canonicalRootId}`);
  }

  const geometryEntries = collectSubtree(
    canonicalRootId,
    maps,
    (node) =>
      geometryNodeTypes.has(node.type) &&
      ((node.fillGeometry?.length ?? 0) > 0 || (node.strokeGeometry?.length ?? 0) > 0),
  );
  const styles = collectStyleEvidence(canonicalRootId, maps);
  const sourceNodeIds = [
    ...new Set([
      ...rootIds,
      ...geometryEntries.map(({ node }) => nodeId(node.guid)),
    ]),
  ].sort(compareNodeIds);

  return {
    effects: styles.effects,
    fills: styles.fills,
    geometry: geometryLayersFromEntries(geometryEntries, blobs),
    instanceNodeIds: [],
    key,
    noSymbolReason: 'no-instance-or-symbol-in-audited-subtree',
    overrides: [],
    size: {
      height: Number((canonicalRoot.size?.y ?? 0).toFixed(6)),
      width: Number((canonicalRoot.size?.x ?? 0).toFixed(6)),
    },
    sourceKind: 'node',
    sourceNodeIds,
    strokes: styles.strokes,
  };
}

function extractSymbolPrimitive(key, instanceId, maps, blobs) {
  const instance = maps.documentNodeById.get(instanceId);
  if (!instance?.symbolData?.symbolID) {
    throw new Error(`Expected symbol-backed instance at ${instanceId}`);
  }
  const symbolNodeId = nodeId(instance.symbolData.symbolID);
  const symbol = maps.documentNodeById.get(symbolNodeId);
  if (!symbol) {
    throw new Error(
      `Found dangling Symbol reference ${symbolNodeId} from instance ${instanceId}`,
    );
  }

  const geometryEntries = collectSubtree(
    symbolNodeId,
    maps,
    (node) =>
      geometryNodeTypes.has(node.type) &&
      ((node.fillGeometry?.length ?? 0) > 0 || (node.strokeGeometry?.length ?? 0) > 0),
  );
  const styles = collectStyleEvidence(symbolNodeId, maps);

  return {
    effects: styles.effects,
    fills: styles.fills,
    geometry: geometryLayersFromEntries(geometryEntries, blobs),
    instanceNodeIds: [instanceId],
    key,
    overrides: collectOverrideEntries(instance.symbolData.symbolOverrides),
    size: {
      height: Number((instance.size?.y ?? 0).toFixed(6)),
      width: Number((instance.size?.x ?? 0).toFixed(6)),
    },
    sourceKind: 'symbol',
    sourceNodeIds: [
      ...new Set([symbolNodeId, ...geometryEntries.map(({ node }) => nodeId(node.guid))]),
    ].sort(compareNodeIds),
    strokes: styles.strokes,
    symbolNodeId,
  };
}

function collectIconLayers(rootId, maps, blobs) {
  const root = maps.documentNodeById.get(rootId);
  if (!root) {
    throw new Error(`Missing icon root ${rootId}`);
  }
  const geometryEntries = collectSubtree(
    rootId,
    maps,
    (node) =>
      iconGeometryTypes.has(node.type) &&
      ((node.fillGeometry?.length ?? 0) > 0 || (node.strokeGeometry?.length ?? 0) > 0),
  );
  return {
    layers: geometryLayersFromEntries(geometryEntries, blobs),
    sourceNodeIds: [
      ...new Set(geometryEntries.map(({ node }) => nodeId(node.guid))),
    ].sort(compareNodeIds),
    viewBox: `0 0 ${formatNumber(root.size?.x ?? 0)} ${formatNumber(root.size?.y ?? 0)}`,
  };
}

function buildIcons(evidence, maps, blobs) {
  const icons = {};
  for (const [iconName, primitiveKey] of Object.entries(iconPrimitiveMap)) {
    const primitive = evidence[primitiveKey];
    if (!primitive) {
      continue;
    }
    const rootId =
      primitive.sourceKind === 'symbol'
        ? primitive.symbolNodeId
        : auditedRoots[primitiveKey][0];
    icons[iconName] = collectIconLayers(rootId, maps, blobs);
  }
  return icons;
}

async function renameIfPresent(from, to, renamePath) {
  try {
    await renamePath(from, to);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function createModuleText(evidence, icons) {
  return `export type FigmaNodeId = \`${'${number}:${number}'}\`;\nexport type MobilePrimitiveKey =\n  | 'settings' | 'back' | 'share' | 'search' | 'bell'\n  | 'microphone' | 'send' | 'arrowRight'\n  | 'home' | 'store' | 'community' | 'products'\n  | 'brandMark' | 'circleAction' | 'bottomNav' | 'glassCard';\n\nexport type FigmaVectorLayer = {\n  sourceNodeId: FigmaNodeId;\n  path: string;\n  fill?: string;\n  stroke?: string;\n  strokeWidth?: number;\n  strokeLinecap?: 'butt' | 'round' | 'square';\n  strokeLinejoin?: 'miter' | 'round' | 'bevel';\n  opacity: number;\n  transform?: string;\n};\n\nexport type FigmaPaintEvidence = {\n  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';\n  color?: string;\n  opacity: number;\n  styleId?: string;\n  variableIds: readonly string[];\n};\n\nexport type FigmaEffectEvidence = {\n  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';\n  radius: number;\n  color?: string;\n  offset?: { x: number; y: number };\n  styleId?: string;\n};\n\nexport type FigmaOverrideEvidence = {\n  guidPath: readonly FigmaNodeId[];\n  property: string;\n  value: string | number | boolean | null;\n};\n\nexport type FigmaPrimitiveEvidence = {\n  key: MobilePrimitiveKey;\n  sourceKind: 'symbol' | 'node';\n  sourceNodeIds: readonly FigmaNodeId[];\n  instanceNodeIds: readonly FigmaNodeId[];\n  symbolNodeId?: FigmaNodeId;\n  noSymbolReason?: 'no-instance-or-symbol-in-audited-subtree';\n  size: { width: number; height: number };\n  geometry: readonly FigmaVectorLayer[];\n  fills: readonly FigmaPaintEvidence[];\n  strokes: readonly FigmaPaintEvidence[];\n  effects: readonly FigmaEffectEvidence[];\n  overrides: readonly FigmaOverrideEvidence[];\n};\n\nexport const auditedMobilePrimitiveKeys = ${stableSerialize(
    primitiveOrder,
  )} as const;\n\nexport const figmaComponentEvidence = ${stableSerialize(
    evidence,
  )} as const satisfies Readonly<Record<MobilePrimitiveKey, FigmaPrimitiveEvidence>>;\n\nexport const figmaMobileIcons = ${stableSerialize(
    icons,
  )} as const satisfies Readonly<Record<\n  'settings' | 'back' | 'share' | 'search' | 'bell' | 'microphone' | 'send' | 'arrow-right' |\n  'house' | 'layout-grid' | 'compass' | 'user',\n  { sourceNodeIds: readonly FigmaNodeId[]; viewBox: string; layers: readonly FigmaVectorLayer[] }\n>>;\n\nexport function getFigmaMobileIcon(name: keyof typeof figmaMobileIcons) {\n  return figmaMobileIcons[name];\n}\n`;
}

function validateZip(figPath) {
  execFileSync('unzip', ['-t', figPath], { stdio: 'pipe' });
  const listing = execFileSync('unzip', ['-l', figPath], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  for (const required of ['canvas.fig', 'meta.json', 'thumbnail.png']) {
    if (!listing.includes(required)) {
      throw new Error(`Missing ${required} in ${figPath}`);
    }
  }
}

export async function extractMobileComponentEvidence({
  designSource = defaultDesignSource,
  outputPath = path.resolve('design/figmaComponentEvidence.ts'),
  renamePath = rename,
  auditedRoots: selectedRoots = auditedRoots,
} = {}) {
  const documentPath = path.join(designSource, 'design-data/document.kiwi.json');
  const mobileNodesPath = path.join(designSource, 'design-data/移动端UI.nodes.json');
  const figPath = path.join(designSource, 'original/IntelliDeploy.fig');

  const [documentText, mobileText] = await Promise.all([
    readFile(documentPath, 'utf8'),
    readFile(mobileNodesPath, 'utf8'),
  ]);
  validateZip(figPath);

  const document = JSON.parse(documentText);
  const mobile = JSON.parse(mobileText);
  if (!Array.isArray(document.nodeChanges) || !Array.isArray(document.blobs)) {
    throw new Error('document.kiwi.json must include nodeChanges and blobs');
  }
  if (!Array.isArray(mobile.nodes)) {
    throw new Error('移动端UI.nodes.json must include nodes');
  }

  const maps = createNodeMaps(document.nodeChanges, mobile.nodes);
  for (const rootIds of Object.values(selectedRoots)) {
    for (const rootId of rootIds) {
      if (!maps.mobileNodeById.has(rootId)) {
        throw new Error(`Missing audited root ${rootId} in 移动端UI.nodes.json`);
      }
    }
  }

  for (const node of document.nodeChanges) {
    const symbolId = node.symbolData?.symbolID ? nodeId(node.symbolData.symbolID) : null;
    if (symbolId && !maps.documentNodeById.has(symbolId)) {
      throw new Error(
        `Found dangling Symbol reference ${symbolId} from instance ${nodeId(node.guid)}`,
      );
    }
  }

  if (maps.documentNodeById.has('266:21480')) {
    const settingsSymbolId = nodeId(
      maps.documentNodeById.get('266:21480')?.symbolData?.symbolID ?? {},
    );
    if (settingsSymbolId !== '248:20538') {
      throw new Error(
        `Expected 266:21480 to resolve to 248:20538, received ${settingsSymbolId}`,
      );
    }
  }

  const evidence = {};
  for (const key of primitiveOrder) {
    const roots = selectedRoots[key];
    if (!roots) {
      continue;
    }
    evidence[key] =
      key === 'settings'
        ? extractSymbolPrimitive(key, roots[0], maps, document.blobs)
        : extractNodePrimitive(key, roots, maps, document.blobs);
  }

  if (maps.documentNodeById.has('266:21480') && evidence.settings?.symbolNodeId !== '248:20538') {
    throw new Error(
      `Expected 266:21480 evidence to resolve to 248:20538, received ${evidence.settings?.symbolNodeId}`,
    );
  }

  const icons = buildIcons(evidence, maps, document.blobs);
  const moduleText = createModuleText(evidence, icons);
  const suffix = `${process.pid}-${randomUUID()}`;
  const stagedOutput = `${outputPath}.tmp-${suffix}`;
  const backupOutput = `${outputPath}.backup-${suffix}`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(stagedOutput, moduleText);

  let previousMoved = false;
  let installed = false;
  try {
    previousMoved = await renameIfPresent(outputPath, backupOutput, renamePath);
    await renamePath(stagedOutput, outputPath);
    installed = true;
  } catch (error) {
    if (installed) {
      await rm(outputPath, { force: true });
    }
    if (previousMoved) {
      await renamePath(backupOutput, outputPath);
    }
    await rm(stagedOutput, { force: true });
    throw error;
  }

  await rm(backupOutput, { force: true });
  return {
    iconCount: Object.keys(icons).length,
    primitiveCount: primitiveOrder.length,
    symbolCount: document.nodeChanges.filter((node) => node.type === 'SYMBOL').length,
  };
}

const isEntryPoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntryPoint) {
  const result = await extractMobileComponentEvidence();
  console.log(
    `Extracted ${result.primitiveCount} primitives and ${result.iconCount} icons from ${result.symbolCount} symbols.`,
  );
}
