import fs from 'node:fs/promises';

const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
if (!source) throw Error('Set INTELLIDEPLOY_FIGMA_SOURCE');
const document = JSON.parse(
  await fs.readFile(`${source}/design-data/document.kiwi.json`, 'utf8'),
);
const id = (guid) => `${guid.sessionID}:${guid.localID}`;
const nodes = new Map(document.nodeChanges.map((value) => [id(value.guid), value]));
const node = (nodeId) => {
  const value = nodes.get(nodeId);
  if (!value) throw Error(`Missing source node ${nodeId}`);
  return value;
};
const requestedIds = ['270:26244', '376:4769'];
for (const requestedId of requestedIds) {
  if (nodes.has(requestedId)) throw Error(`Previously absent source node now exists: ${requestedId}`);
}
const formalFrame = node('270:26597');
if (formalFrame.type !== 'FRAME' || formalFrame.size.x !== 375 || formalFrame.size.y !== 812) {
  throw Error('Store formal frame 270:26597 must remain a 375x812 FRAME');
}

const identity = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
const multiply = (left, right) => ({
  m00: left.m00 * right.m00 + left.m01 * right.m10,
  m01: left.m00 * right.m01 + left.m01 * right.m11,
  m02: left.m00 * right.m02 + left.m01 * right.m12 + left.m02,
  m10: left.m10 * right.m00 + left.m11 * right.m10,
  m11: left.m10 * right.m01 + left.m11 * right.m11,
  m12: left.m10 * right.m02 + left.m11 * right.m12 + left.m12,
});
const inverse = (matrix) => {
  const determinant = matrix.m00 * matrix.m11 - matrix.m01 * matrix.m10;
  if (Math.abs(determinant) < 1e-12) throw Error('Non-invertible source matrix');
  return {
    m00: matrix.m11 / determinant,
    m01: -matrix.m01 / determinant,
    m02: (matrix.m01 * matrix.m12 - matrix.m11 * matrix.m02) / determinant,
    m10: -matrix.m10 / determinant,
    m11: matrix.m00 / determinant,
    m12: (matrix.m10 * matrix.m02 - matrix.m00 * matrix.m12) / determinant,
  };
};
const color = (value) => ({
  alpha: value.a,
  hex: `#${[value.r, value.g, value.b]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`,
});
const paint = (value) => ({
  blendMode: value.blendMode ?? 'NORMAL',
  color: value.color ? color(value.color) : null,
  imageHash: value.image?.hash ?? null,
  opacity: value.opacity,
  type: value.type,
  visible: value.visible,
});
const effect = (value) => ({
  blendMode: value.blendMode ?? 'NORMAL',
  chromaticAberration: value.chromaticAberration ?? null,
  color: value.color ? color(value.color) : null,
  density: value.density ?? null,
  offset: value.offset ?? null,
  opacity: value.opacity ?? null,
  radius: value.radius ?? null,
  rawType: value.type,
  refractionIntensity: value.refractionIntensity ?? null,
  refractionRadius: value.refractionRadius ?? null,
  seed: value.seed ?? null,
  specularAngle: value.specularAngle ?? null,
  specularIntensity: value.specularIntensity ?? null,
  spread: value.spread ?? null,
  visible: value.visible,
});
const effects = (value) => (value.effects ?? []).map(effect);
const text = (nodeId) => {
  const value = node(nodeId);
  return {
    sourceNodeId: nodeId,
    fontSize: value.fontSize,
    fontName: value.fontName,
    lineHeight: value.lineHeight.value,
    size: value.size,
    textColor: color(value.fillPaints[0].color).hex,
  };
};
const surface = (nodeId, matrix = node(nodeId).transform) => {
  const value = node(nodeId);
  return {
    sourceNodeId: nodeId,
    size: value.size,
    matrix,
    cornerRadius: value.cornerRadius,
    strokeWeight: value.strokeWeight ?? 0,
    fill: paint(value.fillPaints[0]),
    strokes: (value.strokePaints ?? []).map(paint),
    effects: effects(value),
  };
};
const children = new Map();
for (const value of document.nodeChanges) {
  if (!value.parentIndex?.guid) continue;
  const parentId = id(value.parentIndex.guid);
  children.set(parentId, [...(children.get(parentId) ?? []), value]);
}
const descendants = (rootId) => {
  const result = [];
  const visit = (parentId) => {
    for (const child of children.get(parentId) ?? []) {
      result.push(child);
      visit(id(child.guid));
    }
  };
  visit(rootId);
  return result;
};
const pageDescendants = descendants('270:26597');
const ancestors = (value) => {
  const result = [];
  let parentGuid = value.parentIndex?.guid;
  while (parentGuid) {
    const parent = node(id(parentGuid));
    result.push({ nodeId: id(parent.guid), name: parent.name, type: parent.type });
    parentGuid = parent.parentIndex?.guid;
  }
  return result;
};
const auditEntry = (value) => ({
  nodeId: id(value.guid),
  ancestors: ancestors(value),
  raw: value,
});
const sharedBottomNavInstance = (value) => ({
  ...auditEntry(value),
  semanticScope: 'shared-bottom-navigation-state-control',
  sharedPrimitive: 'BottomNav',
  runtimeSupport: 'NOT_IMPLEMENTED',
  runtimeReason:
    'BottomNav switches selected route state immediately; source SWAP_STATE SMART_ANIMATE is not implemented by the shared BottomNav primitive',
});
const sourceAudit = {
  sourceFrameId: '270:26597',
  requestedIdsAbsent: requestedIds.filter((requestedId) => !nodes.has(requestedId)),
  formalFrame: auditEntry(formalFrame),
  descendantCount: pageDescendants.length,
  descendants: pageDescendants.map(auditEntry),
  instances: pageDescendants
    .filter((value) => value.type === 'INSTANCE')
    .map(sharedBottomNavInstance),
  prototypeInteractions: pageDescendants
    .filter((value) => value.prototypeInteractions?.length)
    .map((value) => ({
      nodeId: id(value.guid),
      ancestors: ancestors(value),
      raw: value.prototypeInteractions,
    })),
};

const rearLayer = ({ rootId, surfaceId, iconId, iconSurfaceId, titleId, titleTextId, metaTextId, summaryId, pagerId, dividerId, previewId }) => {
  const root = node(rootId);
  const rootMatrix = root.transform ?? identity;
  const absolute = (nodeId) => multiply(rootMatrix, node(nodeId).transform ?? identity);
  const surfaceMatrix = absolute(surfaceId);
  const local = (nodeId) => multiply(inverse(surfaceMatrix), absolute(nodeId));
  const pager = node(pagerId);
  return {
    rootNodeId: rootId,
    surface: surface(surfaceId, surfaceMatrix),
    content: {
      icon: {
        sourceNodeId: iconId,
        size: node(iconId).size,
        matrix: local(iconId),
        surface: surface(iconSurfaceId, node(iconSurfaceId).transform),
      },
      title: { sourceNodeId: titleId, size: node(titleId).size, matrix: local(titleId), text: text(titleTextId) },
      metadata: text(metaTextId),
      summary: { sourceNodeId: summaryId, size: node(summaryId).size, matrix: local(summaryId), text: text(summaryId) },
      pager: {
        sourceNodeId: pagerId,
        size: pager.size,
        matrix: local(pagerId),
        dots: (children.get(pagerId) ?? []).map((value) => ({
          sourceNodeId: id(value.guid),
          size: value.size,
          transform: value.transform,
          fill: paint(value.fillPaints[0]),
        })),
      },
      divider: {
        sourceNodeId: dividerId,
        size: node(dividerId).size,
        matrix: local(dividerId),
        strokes: (node(dividerId).strokePaints ?? []).map(paint),
      },
      preview: {
        sourceNodeId: previewId,
        size: node(previewId).size,
        matrix: local(previewId),
        clipsContent: node(previewId).frameMaskDisabled === false,
      },
    },
  };
};

const titleParent = node('270:26717');
const iconParent = node('270:26714');
const icon = node('270:26715');
const summary = node('270:26732');
const preview = node('270:26754');
const carousel = node('270:26636');
const foregroundGroup = node('270:26712');
const foreground = node('270:26713');
const backFiveGroup = node('270:26674');
const backFive = node('270:26675');
const backTen = node('270:26640');
const foregroundMatrix = multiply(foregroundGroup.transform, foreground.transform);
const backFiveMatrix = multiply(backFiveGroup.transform, backFive.transform);
const backTenLayer = rearLayer({
  rootId: '270:26639', surfaceId: '270:26640', iconId: '270:26641', iconSurfaceId: '270:26642', titleId: '270:26644',
  titleTextId: '270:26645', metaTextId: '270:26646', summaryId: '270:26659',
  pagerId: '270:26653', dividerId: '270:26671', previewId: '270:26672',
});
const backFiveLayer = rearLayer({
  rootId: '270:26674', surfaceId: '270:26675', iconId: '270:26676', iconSurfaceId: '270:26677', titleId: '270:26679',
  titleTextId: '270:26680', metaTextId: '270:26681', summaryId: '270:26694',
  pagerId: '270:26688', dividerId: '270:26706', previewId: '270:26707',
});

const result = {
  sourceFrameId: '270:26597',
  sourceFrameSize: formalFrame.size,
  search: {
    frameNodeId: '270:26623',
    size: node('270:26623').size,
    transform: node('270:26623').transform,
    surface: surface('270:26624'),
    unsupportedEffects: ['GLASS', 'NOISE'],
  },
  carousel: {
    sourceNodeId: '270:26636',
    size: carousel.size,
    transform: carousel.transform,
    sourceGap: backFiveMatrix.m02 - foregroundGroup.transform.m02,
    layers: {
      backTen: backTenLayer.surface,
      backFive: backFiveLayer.surface,
      foreground: surface('270:26713', foregroundMatrix),
    },
  },
  rearLayers: { backTen: backTenLayer, backFive: backFiveLayer },
  sourceNodeId: '270:26712',
  size: foregroundGroup.size,
  backgroundColor: color(foreground.fillPaints[0].color).hex,
  title: { ...text('270:26718'), position: titleParent.transform },
  secondaryText: text('270:26719'),
  initial: {
    sourceNodeId: '270:26715',
    size: icon.size,
    x: iconParent.transform.m02 + icon.transform.m02,
    y: iconParent.transform.m12 + icon.transform.m12,
    cornerRadius: icon.cornerRadius,
    backgroundColor: color(icon.fillPaints[0].color).hex,
  },
  summary: { ...text('270:26732'), position: summary.transform },
  preview: {
    sourceNodeId: '270:26754',
    size: preview.size,
    position: preview.transform,
    clipsContent: preview.frameMaskDisabled === false,
  },
};

await fs.writeFile(
  process.env.INTELLIDEPLOY_RUNTIME_EVIDENCE_OUTPUT ??
    process.env.INTELLIDEPLOY_EVIDENCE_OUTPUT ??
    new URL('../design/storeCardRenderEvidence.ts', import.meta.url),
  `// Generated from the validated store03 frame; business copy remains Publication API-only.\nexport const storeCardRenderEvidence=${JSON.stringify(result, null, 2)} as const;\n`,
);
await fs.writeFile(
  process.env.INTELLIDEPLOY_AUDIT_EVIDENCE_OUTPUT ??
    new URL('../design/storeCardSourceAudit.ts', import.meta.url),
  `// Audit-only raw store03 source; runtime modules must not import this artifact.\nexport const storeCardSourceAudit=${JSON.stringify(sourceAudit, null, 2)} as const;\n`,
);
