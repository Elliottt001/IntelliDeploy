import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const defaultDesignSource =
  '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221';
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultOutputPath = path.resolve(
  scriptDirectory,
  '../design/figmaComponentEvidence.ts',
);

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
  glassCard: ['825:6570', '825:6575'],
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

const iconRoots = {
  settings: '248:20525',
  back: '845:3505',
  share: '845:3512',
  search: '270:26625',
  bell: '825:6482',
  microphone: '845:3535',
  send: '845:3540',
  'arrow-right': '825:7025',
  house: '270:26534',
  'layout-grid': '270:26540',
  compass: '270:26548',
  user: '270:26554',
};

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
  return Number(value.toFixed(6)).toString();
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

function invertTransform(transform) {
  const determinant = transform.m00 * transform.m11 - transform.m01 * transform.m10;
  if (Math.abs(determinant) < 1e-8) {
    throw new Error(`Cannot invert singular transform ${JSON.stringify(transform)}`);
  }
  const inverseDeterminant = 1 / determinant;
  return {
    m00: transform.m11 * inverseDeterminant,
    m01: -transform.m01 * inverseDeterminant,
    m02:
      (transform.m01 * transform.m12 - transform.m11 * transform.m02) *
      inverseDeterminant,
    m10: -transform.m10 * inverseDeterminant,
    m11: transform.m00 * inverseDeterminant,
    m12:
      (transform.m10 * transform.m02 - transform.m00 * transform.m12) *
      inverseDeterminant,
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

function toFillRule(windingRule) {
  return windingRule === 'EVENODD' ? 'evenodd' : 'nonzero';
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

function colorOpacity(color, authoredColor) {
  return color?.a ?? authoredColor?.c3 ?? 1;
}

function paintOpacity(paint) {
  return Number(
    (
      paint?.opacity ??
      colorOpacity(paint?.color, paint?.authoredColor) ??
      1
    ).toFixed(6),
  );
}

function effectOpacity(effect) {
  return Number(
    (
      effect?.opacity ??
      colorOpacity(effect?.color, effect?.authoredColor) ??
      1
    ).toFixed(6),
  );
}

function collectAliasNodeIds(value, ids) {
  if (!value || typeof value !== 'object') {
    return;
  }
  const guid = value.value?.alias?.guid ?? value.alias?.guid ?? value.guid;
  if (guid?.sessionID != null && guid?.localID != null) {
    ids.add(nodeId(guid));
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      collectAliasNodeIds(child, ids);
    }
    return;
  }
  for (const child of Object.values(value)) {
    collectAliasNodeIds(child, ids);
  }
}

function variableIdsFromPaint(paint) {
  const ids = new Set();
  collectAliasNodeIds(paint, ids);
  return [...ids].sort(compareNodeIds);
}

function normalizePaint(paint) {
  if (!paint || paint.visible === false) {
    return null;
  }
  return {
    color: colorToHex(paint.color ?? paint.authoredColor),
    gradientStops: paint.stops?.map((stop, index) => ({
      color: colorToHex(stop.color ?? stop.authoredColor),
      opacity: Number(
        (
          colorOpacity(
            stop.color,
            paint.authoredStops?.[index]?.authoredColor ?? stop.authoredColor,
          ) ?? 1
        ).toFixed(6),
      ),
      position: Number((stop.position ?? 0).toFixed(6)),
      variableIds: variableIdsFromPaint(paint.stopsVar?.[index]),
    })),
    opacity: paintOpacity(paint),
    styleId:
      paint.styleId?.guid != null ? nodeId(paint.styleId.guid) : undefined,
    transform:
      paint.transform && !isIdentityTransform(paint.transform)
        ? toSvgMatrix(paint.transform)
        : undefined,
    type: paint.type,
    variableIds: variableIdsFromPaint(paint),
  };
}

function normalizeEffect(effect) {
  if (!effect || effect.visible === false) {
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
    blendMode: effect.blendMode,
    blurOpType: effect.blurOpType,
    clipToShape: effect.clipToShape,
    color: colorToHex(effect.color ?? effect.authoredColor),
    chromaticAberration:
      effect.chromaticAberration == null
        ? undefined
        : Number(effect.chromaticAberration.toFixed(6)),
    density:
      effect.density == null ? undefined : Number(effect.density.toFixed(6)),
    noiseSize:
      effect.noiseSize == null
        ? undefined
        : {
            x: Number((effect.noiseSize.x ?? 0).toFixed(6)),
            y: Number((effect.noiseSize.y ?? 0).toFixed(6)),
          },
    noiseType: effect.noiseType,
    offset:
      effect.offset == null
        ? undefined
        : {
            x: Number((effect.offset.x ?? 0).toFixed(6)),
            y: Number((effect.offset.y ?? 0).toFixed(6)),
          },
    opacity: effectOpacity(effect),
    radius: Number((effect.radius ?? 0).toFixed(6)),
    rawType: effect.type,
    reflectionDistance:
      effect.reflectionDistance == null
        ? undefined
        : Number(effect.reflectionDistance.toFixed(6)),
    refractionIntensity:
      effect.refractionIntensity == null
        ? undefined
        : Number(effect.refractionIntensity.toFixed(6)),
    refractionRadius:
      effect.refractionRadius == null
        ? undefined
        : Number(effect.refractionRadius.toFixed(6)),
    secondaryColor: colorToHex(
      effect.secondaryColor ?? effect.secondaryAuthoredColor,
    ),
    secondaryOpacity:
      effect.secondaryColor == null && effect.secondaryAuthoredColor == null
        ? undefined
        : Number(
            (
              colorOpacity(
                effect.secondaryColor,
                effect.secondaryAuthoredColor,
              ) ?? 1
            ).toFixed(6),
          ),
    seed: effect.seed,
    showShadowBehindNode: effect.showShadowBehindNode,
    spread:
      effect.spread == null ? undefined : Number(effect.spread.toFixed(6)),
    specularAngle:
      effect.specularAngle == null
        ? undefined
        : Number(effect.specularAngle.toFixed(6)),
    specularIntensity:
      effect.specularIntensity == null
        ? undefined
        : Number(effect.specularIntensity.toFixed(6)),
    styleId:
      effect.styleId?.guid != null ? nodeId(effect.styleId.guid) : undefined,
    type: typeMap[effect.type] ?? 'DROP_SHADOW',
  };
}

function normalizeCornerRadii(node) {
  const singleRadius =
    node.cornerRadius == null
      ? undefined
      : Number(node.cornerRadius.toFixed(6));
  const topLeft = node.topLeftRadius ?? singleRadius;
  const topRight = node.topRightRadius ?? singleRadius;
  const bottomRight = node.bottomRightRadius ?? singleRadius;
  const bottomLeft = node.bottomLeftRadius ?? singleRadius;
  if ([topLeft, topRight, bottomRight, bottomLeft].every((value) => value == null)) {
    return undefined;
  }
  return {
    bottomLeft: Number((bottomLeft ?? 0).toFixed(6)),
    bottomRight: Number((bottomRight ?? 0).toFixed(6)),
    topLeft: Number((topLeft ?? 0).toFixed(6)),
    topRight: Number((topRight ?? 0).toFixed(6)),
  };
}

function normalizeBorderWidths(node) {
  const top = node.borderTopWeight ?? node.strokeWeight;
  const right = node.borderRightWeight ?? node.strokeWeight;
  const bottom = node.borderBottomWeight ?? node.strokeWeight;
  const left = node.borderLeftWeight ?? node.strokeWeight;
  if ([top, right, bottom, left].every((value) => value == null)) {
    return undefined;
  }
  return {
    bottom: Number((bottom ?? 0).toFixed(6)),
    left: Number((left ?? 0).toFixed(6)),
    right: Number((right ?? 0).toFixed(6)),
    top: Number((top ?? 0).toFixed(6)),
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

function collectPropertyEntries(value, propertyPrefix, guidPath) {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return [{ guidPath, property: propertyPrefix, value }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, index) =>
      collectPropertyEntries(child, `${propertyPrefix}[${index}]`, guidPath),
    );
  }
  return Object.entries(value).flatMap(([key, child]) =>
    collectPropertyEntries(
      child,
      propertyPrefix ? `${propertyPrefix}.${key}` : key,
      guidPath,
    ),
  );
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
  return sortByJson(entries);
}

function collectDerivedEntries(derivedSymbolData = [], blobs) {
  const entries = [];
  for (const derivedEntry of derivedSymbolData) {
    const guidPath = (derivedEntry.guidPath?.guids ?? []).map(nodeId);
    for (const [property, geometries] of [
      ['fillGeometry', derivedEntry.fillGeometry],
      ['strokeGeometry', derivedEntry.strokeGeometry],
    ]) {
      if (!Array.isArray(geometries) || geometries.length === 0) {
        continue;
      }
      for (const geometry of geometries) {
        const blob = blobs[geometry.commandsBlob];
        if (!blob) {
          throw new Error(
            `Missing geometry blob ${geometry.commandsBlob} for derived ${guidPath.join('/')}`,
          );
        }
        entries.push({
          guidPath,
          property,
          value: parseCommandsBlob(blob),
        });
      }
    }
  }
  return sortByJson(entries);
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

function firstVisiblePaint(paints) {
  return (paints ?? []).find((paint) => paint?.visible !== false) ?? null;
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
  const documentNodeById = new Map(
    documentNodes.map((node) => [nodeId(node.guid), node]),
  );
  const mobileNodeById = new Map(mobileNodes.map((node) => [nodeId(node.guid), node]));
  const childIdsByParent = new Map();
  const symbolNodeIds = new Set();
  const instanceNodeIds = new Set();

  for (const node of documentNodes) {
    if (node.type === 'SYMBOL') {
      symbolNodeIds.add(nodeId(node.guid));
    }
    if (node.type === 'INSTANCE' && node.symbolData?.symbolID) {
      instanceNodeIds.add(nodeId(node.guid));
    }
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

  return {
    childIdsByParent,
    documentNodeById,
    instanceNodeIds,
    mobileNodeById,
    symbolNodeIds,
  };
}

function collectSubtree(
  rootId,
  maps,
  predicate,
  {
    initialOpacity = 1,
    initialTransform = identityMatrix(),
  } = {},
) {
  const collected = [];
  if (!maps.documentNodeById.has(rootId)) {
    throw new Error(`Missing audited root ${rootId}`);
  }

  const visit = (currentId, transform, inheritedOpacity, guidPath) => {
    const node = maps.documentNodeById.get(currentId);
    if (!node) {
      return;
    }
    const opacity = Number((inheritedOpacity * (node.opacity ?? 1)).toFixed(6));
    if (predicate(node)) {
      collected.push({ guidPath, node, opacity, transform });
    }
    for (const childId of maps.childIdsByParent.get(currentId) ?? []) {
      const child = maps.documentNodeById.get(childId);
      visit(
        childId,
        multiplyTransforms(transform, child?.transform ?? identityMatrix()),
        opacity,
        [...guidPath, childId],
      );
    }
  };

  visit(rootId, initialTransform, initialOpacity, [rootId]);
  return collected;
}

function collectTreeStyleEvidence(rootId, maps) {
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

function collectNodeStyleEvidence(node) {
  return {
    effects: sortByJson(
      (node.effects ?? []).map(normalizeEffect).filter(Boolean),
    ),
    fills: sortByJson(
      (node.fillPaints ?? []).map(normalizePaint).filter(Boolean),
    ),
    strokes: sortByJson(
      (node.strokePaints ?? []).map(normalizePaint).filter(Boolean),
    ),
  };
}

function geometryLayersFromEntries(entries, blobs, derivedGeometryByPath = new Map()) {
  const layers = [];
  for (const entry of entries) {
    const pathKey = entry.guidPath.join('/');
    const derivedGeometry = derivedGeometryByPath.get(pathKey);
    const fillGeometries = derivedGeometry?.fillGeometry ?? entry.node.fillGeometry ?? [];
    const strokeGeometries =
      derivedGeometry?.strokeGeometry ?? entry.node.strokeGeometry ?? [];

    const fillPaint = firstVisiblePaint(entry.node.fillPaints);
    for (const geometry of fillGeometries) {
      const blob = blobs[geometry.commandsBlob];
      if (!blob) {
        throw new Error(
          `Missing geometry blob ${geometry.commandsBlob} for ${nodeId(entry.node.guid)}`,
        );
      }
      const fill = colorToHex(fillPaint?.color ?? fillPaint?.authoredColor);
      if (!fill) {
        continue;
      }
      layers.push({
        fill,
        fillRule: toFillRule(geometry.windingRule),
        opacity: Number((entry.opacity * paintOpacity(fillPaint)).toFixed(6)),
        path: parseCommandsBlob(blob),
        sourceNodeId: nodeId(entry.node.guid),
        transform: isIdentityTransform(entry.transform)
          ? undefined
          : toSvgMatrix(entry.transform),
      });
    }

    const strokePaint = firstVisiblePaint(entry.node.strokePaints);
    for (const geometry of strokeGeometries) {
      const blob = blobs[geometry.commandsBlob];
      if (!blob) {
        throw new Error(
          `Missing geometry blob ${geometry.commandsBlob} for ${nodeId(entry.node.guid)}`,
        );
      }
      const fill = colorToHex(strokePaint?.color ?? strokePaint?.authoredColor);
      if (!fill) {
        continue;
      }
      layers.push({
        fill,
        fillRule: toFillRule(geometry.windingRule),
        opacity: Number((entry.opacity * paintOpacity(strokePaint)).toFixed(6)),
        path: parseCommandsBlob(blob),
        sourceNodeId: nodeId(entry.node.guid),
        strokeLinecap: strokeLinecapFor(entry.node),
        strokeLinejoin: strokeLinejoinFor(entry.node),
        transform: isIdentityTransform(entry.transform)
          ? undefined
          : toSvgMatrix(entry.transform),
      });
    }
  }
  return sortByJson(layers);
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
  const surfaceStyles = collectNodeStyleEvidence(canonicalRoot);
  const allStyles = collectTreeStyleEvidence(canonicalRootId, maps);

  return {
    borderWidths: normalizeBorderWidths(canonicalRoot),
    componentValues: [],
    cornerRadii: normalizeCornerRadii(canonicalRoot),
    derivedValues: [],
    effects: allStyles.effects,
    fills: allStyles.fills,
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
    sourceNodeIds: [
      ...new Set([
        ...rootIds,
        ...geometryEntries.map(({ node }) => nodeId(node.guid)),
      ]),
    ].sort(compareNodeIds),
    strokes: allStyles.strokes,
    surfaceEffects: surfaceStyles.effects,
    surfaceFills: surfaceStyles.fills,
    surfaceNodeId: canonicalRootId,
    surfaceStrokes: surfaceStyles.strokes,
  };
}

function findSymbolBackedInstance(rootIds, maps) {
  const instanceIds = [];
  for (const rootId of rootIds) {
    const subtree = collectSubtree(
      rootId,
      maps,
      (node) => node.type === 'INSTANCE' && node.symbolData?.symbolID,
    );
    for (const entry of subtree) {
      instanceIds.push(nodeId(entry.node.guid));
    }
  }
  return [...new Set(instanceIds)].sort(compareNodeIds)[0];
}

function buildDerivedGeometryMap(derivedSymbolData = []) {
  const map = new Map();
  for (const derivedEntry of derivedSymbolData) {
    const key = (derivedEntry.guidPath?.guids ?? []).map(nodeId).join('/');
    map.set(key, derivedEntry);
  }
  return map;
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
  if (symbol.type !== 'SYMBOL') {
    throw new Error(
      `Expected a SYMBOL target for instance ${instanceId}, received ${symbol.type} at ${symbolNodeId}`,
    );
  }

  const relativeTransform = multiplyTransforms(
    instance.transform ?? identityMatrix(),
    invertTransform(symbol.transform ?? identityMatrix()),
  );
  const derivedGeometryByPath = buildDerivedGeometryMap(instance.derivedSymbolData);
  const geometryEntries = collectSubtree(
    symbolNodeId,
    maps,
    (node) =>
      geometryNodeTypes.has(node.type) &&
      ((node.fillGeometry?.length ?? 0) > 0 || (node.strokeGeometry?.length ?? 0) > 0),
    {
      initialOpacity: instance.opacity ?? 1,
      initialTransform: relativeTransform,
    },
  );
  const symbolStyles = collectTreeStyleEvidence(symbolNodeId, maps);
  const surfaceStyles = collectNodeStyleEvidence(symbol);
  const componentValues = sortByJson([
    ...collectPropertyEntries(
      instance.componentProperties ?? {},
      'componentProperties',
      [instanceId],
    ),
    ...collectPropertyEntries(
      symbol.componentPropertyDefinitions ?? {},
      'componentPropertyDefinitions',
      [symbolNodeId],
    ),
  ]);

  return {
    borderWidths: normalizeBorderWidths(symbol),
    componentValues,
    cornerRadii: normalizeCornerRadii(symbol),
    derivedValues: collectDerivedEntries(instance.derivedSymbolData, blobs),
    effects: symbolStyles.effects,
    fills: symbolStyles.fills,
    geometry: geometryLayersFromEntries(
      geometryEntries,
      blobs,
      derivedGeometryByPath,
    ),
    instanceNodeIds: [instanceId],
    instanceTransform:
      instance.transform && !isIdentityTransform(instance.transform)
        ? toSvgMatrix(instance.transform)
        : undefined,
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
    strokes: symbolStyles.strokes,
    surfaceEffects: surfaceStyles.effects,
    surfaceFills: surfaceStyles.fills,
    surfaceNodeId: symbolNodeId,
    surfaceStrokes: surfaceStyles.strokes,
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
      geometryNodeTypes.has(node.type) &&
      ((node.fillGeometry?.length ?? 0) > 0 || (node.strokeGeometry?.length ?? 0) > 0),
  );
  const layers = geometryLayersFromEntries(geometryEntries, blobs);
  return {
    layers,
    sourceNodeIds: [...new Set(layers.map((layer) => layer.sourceNodeId))].sort(
      compareNodeIds,
    ),
    viewBox: `0 0 ${formatNumber(root.size?.x ?? 0)} ${formatNumber(root.size?.y ?? 0)}`,
  };
}

function buildIcons(maps, blobs) {
  const icons = {};
  for (const iconName of Object.keys(iconPrimitiveMap)) {
    if (!maps.documentNodeById.has(iconRoots[iconName])) {
      continue;
    }
    icons[iconName] = collectIconLayers(iconRoots[iconName], maps, blobs);
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
  return `export type FigmaNodeId = \`${'${number}:${number}'}\`;\nexport type MobilePrimitiveKey =\n  | 'settings' | 'back' | 'share' | 'search' | 'bell'\n  | 'microphone' | 'send' | 'arrowRight'\n  | 'home' | 'store' | 'community' | 'products'\n  | 'brandMark' | 'circleAction' | 'bottomNav' | 'glassCard';\n\nexport type FigmaVectorLayer = {\n  sourceNodeId: FigmaNodeId;\n  path: string;\n  fill?: string;\n  fillRule?: 'nonzero' | 'evenodd';\n  stroke?: string;\n  strokeWidth?: number;\n  strokeLinecap?: 'butt' | 'round' | 'square';\n  strokeLinejoin?: 'miter' | 'round' | 'bevel';\n  opacity: number;\n  transform?: string;\n};\n\nexport type FigmaGradientStopEvidence = {\n  color?: string;\n  opacity: number;\n  position: number;\n  variableIds: readonly string[];\n};\n\nexport type FigmaPaintEvidence = {\n  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';\n  color?: string;\n  gradientStops?: readonly FigmaGradientStopEvidence[];\n  opacity: number;\n  styleId?: string;\n  transform?: string;\n  variableIds: readonly string[];\n};\n\nexport type FigmaEffectEvidence = {\n  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';\n  radius: number;\n  blendMode?: string;\n  blurOpType?: string;\n  clipToShape?: boolean;\n  color?: string;\n  chromaticAberration?: number;\n  density?: number;\n  noiseSize?: { x: number; y: number };\n  noiseType?: string;\n  offset?: { x: number; y: number };\n  opacity?: number;\n  rawType?: string;\n  reflectionDistance?: number;\n  refractionIntensity?: number;\n  refractionRadius?: number;\n  secondaryColor?: string;\n  secondaryOpacity?: number;\n  seed?: number;\n  showShadowBehindNode?: boolean;\n  spread?: number;\n  specularAngle?: number;\n  specularIntensity?: number;\n  styleId?: string;\n};\n\nexport type FigmaOverrideEvidence = {\n  guidPath: readonly FigmaNodeId[];\n  property: string;\n  value: string | number | boolean | null;\n};\n\nexport type FigmaCornerRadiiEvidence = {\n  topLeft: number;\n  topRight: number;\n  bottomRight: number;\n  bottomLeft: number;\n};\n\nexport type FigmaBorderWidthsEvidence = {\n  top: number;\n  right: number;\n  bottom: number;\n  left: number;\n};\n\nexport type FigmaPrimitiveEvidence = {\n  key: MobilePrimitiveKey;\n  sourceKind: 'symbol' | 'node';\n  sourceNodeIds: readonly FigmaNodeId[];\n  instanceNodeIds: readonly FigmaNodeId[];\n  symbolNodeId?: FigmaNodeId;\n  noSymbolReason?: 'no-instance-or-symbol-in-audited-subtree';\n  size: { width: number; height: number };\n  geometry: readonly FigmaVectorLayer[];\n  fills: readonly FigmaPaintEvidence[];\n  strokes: readonly FigmaPaintEvidence[];\n  effects: readonly FigmaEffectEvidence[];\n  overrides: readonly FigmaOverrideEvidence[];\n  componentValues?: readonly FigmaOverrideEvidence[];\n  derivedValues?: readonly FigmaOverrideEvidence[];\n  instanceTransform?: string;\n  surfaceNodeId?: FigmaNodeId;\n  surfaceFills?: readonly FigmaPaintEvidence[];\n  surfaceStrokes?: readonly FigmaPaintEvidence[];\n  surfaceEffects?: readonly FigmaEffectEvidence[];\n  cornerRadii?: FigmaCornerRadiiEvidence;\n  borderWidths?: FigmaBorderWidthsEvidence;\n};\n\nexport const auditedMobilePrimitiveKeys = ${stableSerialize(
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
  outputPath = defaultOutputPath,
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

  for (const instanceId of maps.instanceNodeIds) {
    const instance = maps.documentNodeById.get(instanceId);
    const symbolId = instance?.symbolData?.symbolID
      ? nodeId(instance.symbolData.symbolID)
      : null;
    if (!symbolId) {
      continue;
    }
    const symbolNode = maps.documentNodeById.get(symbolId);
    if (!symbolNode) {
      throw new Error(
        `Found dangling Symbol reference ${symbolId} from instance ${instanceId}`,
      );
    }
    if (symbolNode.type !== 'SYMBOL') {
      throw new Error(
        `Expected a SYMBOL target for instance ${instanceId}, received ${symbolNode.type} at ${symbolId}`,
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
    const symbolBackedInstance = findSymbolBackedInstance(roots, maps);
    evidence[key] = symbolBackedInstance
      ? extractSymbolPrimitive(key, symbolBackedInstance, maps, document.blobs)
      : extractNodePrimitive(key, roots, maps, document.blobs);
  }

  const icons = buildIcons(maps, document.blobs);
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
