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
const box = (nodeId) => {
  const value = node(nodeId);
  return {
    id: nodeId,
    width: value.size.x,
    height: value.size.y,
    x: value.transform.m02,
    y: value.transform.m12,
  };
};
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
    characters: value.textData.characters,
    fontSize: value.fontSize,
    lineHeight: value.lineHeight.value,
    textColor: color(value.fillPaints[0].color),
    fontName: value.fontName,
    size: value.size,
  };
};
const surface = (nodeId) => {
  const value = node(nodeId);
  return {
    sourceNodeId: nodeId,
    size: value.size,
    transform: value.transform,
    cornerRadius: value.cornerRadius,
    fill: value.fillPaints?.[0] ? paint(value.fillPaints[0]) : null,
    strokes: (value.strokePaints ?? []).map(paint),
    effects: effects(value),
  };
};

const instance = node('825:6884');
const navigation = node('825:6984');
const copy = node('825:7034');
const preview = node('825:7032');
const availability = node('825:7041');
const row = node('825:7027');

const ranking = {
  sourceFrameId: '825:6804',
  sourceFrameSize: node('825:6804').size,
  sourceAudit: {
    requestedIdsAbsent: ['270:26244', '376:4769'],
    instance: {
      nodeId: '825:6884',
      symbolId: id(instance.symbolData.symbolID),
      overrideCount: instance.symbolData.symbolOverrides.length,
      interactionCount: instance.prototypeInteractions.length,
    },
    navigation: {
      nodeId: '825:6984',
      interactionCount: navigation.prototypeInteractions.length,
      event: navigation.prototypeInteractions[0].event.interactionType,
      transition: navigation.prototypeInteractions[0].actions[0].transitionType,
      durationMs: navigation.prototypeInteractions[0].actions[0].transitionDuration * 1000,
    },
  },
  layout: {
    header: box('825:6983'),
    hero: box('845:3359'),
    list: box('845:3357'),
    listSurface: box('825:7026'),
  },
  surfaces: {
    heroGroup: surface('845:3359'),
    heroFace: surface('825:7008'),
    list: surface('825:7026'),
  },
  header: text('825:6990'),
  introTitle: text('825:7006'),
  introSubtitle: text('825:7005'),
  name: text('825:7035'),
  summary: text('825:7036'),
  row: {
    sourceNodeId: '825:7027',
    size: row.size,
    copy: {
      sourceNodeId: '825:7034',
      x: copy.transform.m02,
      y: copy.transform.m12,
      size: node('825:7035').size,
    },
    preview: {
      sourceNodeId: '825:7032',
      size: preview.size,
      transform: preview.transform,
      cornerRadius: preview.cornerRadius,
    },
    availability: {
      sourceNodeId: '825:7041',
      size: availability.size,
      transform: availability.transform,
      fill: paint(availability.fillPaints[0]),
      borderColor: color(availability.strokePaints[0].color),
    },
    dividerColor: color(row.strokePaints[0].color),
  },
};

await fs.writeFile(
  new URL('../design/rankingRenderEvidence.ts', import.meta.url),
  `// Generated from ranking40; rows bind only existing Publication DTO fields.\nexport const rankingRenderEvidence=${JSON.stringify(ranking, null, 2)} as const;\n`,
);
