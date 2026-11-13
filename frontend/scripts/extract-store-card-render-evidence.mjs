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
const color = (value) =>
  `#${[value.r, value.g, value.b]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
const multiply = (left, right) => ({
  m00: left.m00 * right.m00 + left.m01 * right.m10,
  m01: left.m00 * right.m01 + left.m01 * right.m11,
  m02: left.m00 * right.m02 + left.m01 * right.m12 + left.m02,
  m10: left.m10 * right.m00 + left.m11 * right.m10,
  m11: left.m10 * right.m01 + left.m11 * right.m11,
  m12: left.m10 * right.m02 + left.m11 * right.m12 + left.m12,
});
const paint = (value) => ({
  color: color(value.color),
  opacity: value.opacity,
  type: value.type,
  visible: value.visible,
});
const effects = (value) =>
  (value.effects ?? []).filter((effect) => effect.visible !== false).map((effect) => ({
    color: effect.color ? color(effect.color) : null,
    offset: effect.offset ?? null,
    radius: effect.radius ?? null,
    rawType: effect.type,
    spread: effect.spread ?? null,
  }));
const text = (nodeId) => {
  const value = node(nodeId);
  return {
    sourceNodeId: nodeId,
    fontSize: value.fontSize,
    fontName: value.fontName,
    lineHeight: value.lineHeight.value,
    size: value.size,
    textColor: color(value.fillPaints[0].color),
  };
};
const surface = (nodeId, matrix = node(nodeId).transform) => {
  const value = node(nodeId);
  return {
    sourceNodeId: nodeId,
    size: value.size,
    matrix,
    cornerRadius: value.cornerRadius,
    fill: paint(value.fillPaints[0]),
    effects: effects(value),
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

const result = {
  sourceFrameId: '270:26597',
  sourceFrameSize: node('270:26597').size,
  sourceAudit: {
    requestedIdsAbsent: ['270:26244', '376:4769'],
    instance: {
      nodeId: '270:26760',
      symbolId: id(node('270:26760').symbolData.symbolID),
      overrideCount: node('270:26760').symbolData.symbolOverrides.length,
      prototypeInteractionCount: node('270:26760').prototypeInteractions.length,
    },
  },
  search: {
    frameNodeId: '270:26623',
    size: node('270:26623').size,
    surface: surface('270:26624'),
  },
  carousel: {
    sourceNodeId: '270:26636',
    size: carousel.size,
    transform: carousel.transform,
    // The nearest authored rear surface supplies the interval gap; it is not a guessed cap.
    sourceGap: backFiveMatrix.m02 - foregroundGroup.transform.m02,
    layers: {
      backTen: surface('270:26640', backTen.transform),
      backFive: surface('270:26675', backFiveMatrix),
      foreground: surface('270:26713', foregroundMatrix),
    },
  },
  sourceNodeId: '270:26712',
  size: foregroundGroup.size,
  backgroundColor: color(foreground.fillPaints[0].color),
  title: { ...text('270:26718'), position: titleParent.transform },
  secondaryText: text('270:26719'),
  initial: {
    sourceNodeId: '270:26715',
    size: icon.size,
    x: iconParent.transform.m02 + icon.transform.m02,
    y: iconParent.transform.m12 + icon.transform.m12,
    cornerRadius: icon.cornerRadius,
    backgroundColor: color(icon.fillPaints[0].color),
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
  new URL('../design/storeCardRenderEvidence.ts', import.meta.url),
  `// Generated from the actual store frame; business copy remains Publication API-only.\nexport const storeCardRenderEvidence=${JSON.stringify(result, null, 2)} as const;\n`,
);
