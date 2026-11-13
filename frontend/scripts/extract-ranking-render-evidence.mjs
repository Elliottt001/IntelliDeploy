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
const formalFrame = node('825:6804');
if (formalFrame.type !== 'FRAME' || formalFrame.size.x !== 375 || formalFrame.size.y !== 812) {
  throw Error('Ranking formal frame 825:6804 must remain a 375x812 FRAME');
}

const color = (value) => ({
  alpha: value.a,
  hex: `#${[value.r, value.g, value.b]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`,
});
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
const paint = (value) => {
  const sourceColor = value.color ? color(value.color) : null;
  return {
    blendMode: value.blendMode ?? 'NORMAL',
    color: sourceColor?.hex ?? null,
    alpha: sourceColor?.alpha ?? null,
    imageHash: value.image?.hash ?? null,
    opacity: value.opacity,
    type: value.type,
    visible: value.visible,
  };
};
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
    characters: value.textData.characters,
    fontSize: value.fontSize,
    lineHeight: value.lineHeight.value,
    textColor: color(value.fillPaints[0].color).hex,
    fontName: value.fontName,
    size: value.size,
    effects: effects(value),
  };
};
const surface = (nodeId) => {
  const value = node(nodeId);
  return {
    sourceNodeId: nodeId,
    size: value.size,
    transform: value.transform,
    cornerRadius: value.cornerRadius,
    strokeWeight: value.strokeWeight ?? 0,
    fill: value.fillPaints?.[0] ? paint(value.fillPaints[0]) : null,
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
const geometry = (values = []) => values.map((value) => ({
  commandsBlob: value.commandsBlob,
  styleID: value.styleID,
  windingRule: value.windingRule,
}));
const auditNode = (value) => ({
  nodeId: id(value.guid),
  parentId: value.parentIndex?.guid ? id(value.parentIndex.guid) : null,
  type: value.type,
  size: value.size ?? null,
  transform: value.transform ?? null,
  visible: value.visible,
  opacity: value.opacity,
  clipsContent: value.frameMaskDisabled === false,
  cornerRadius: value.cornerRadius ?? null,
  fillPaints: (value.fillPaints ?? []).map(paint),
  strokePaints: (value.strokePaints ?? []).map(paint),
  effects: effects(value),
  fillGeometry: geometry(value.fillGeometry),
  strokeGeometry: geometry(value.strokeGeometry),
});
const action = (value) => ({
  durationMs: value.transitionDuration * 1000,
  easingFunction: value.easingFunction,
  easingType: value.easingType,
  navigationType: value.navigationType,
  targetNodeId: value.transitionNodeID ? id(value.transitionNodeID) : null,
  transition: value.transitionType,
});
const interaction = (value) => ({
  interactionId: id(value.id),
  event: value.event.interactionType,
  isDeleted: value.isDeleted,
  actions: value.actions.map(action),
});
const pageDescendants = descendants('825:6804');
const pageAudit = {
  descendantCount: pageDescendants.length,
  paintedNodeCount: pageDescendants.filter(
    (value) => value.fillPaints?.length || value.strokePaints?.length,
  ).length,
  effectNodeCount: pageDescendants.filter((value) => value.effects?.length).length,
  paintEffectNodes: pageDescendants
    .filter((value) => value.fillPaints?.length || value.strokePaints?.length || value.effects?.length)
    .map(auditNode),
  instances: pageDescendants.filter((value) => value.type === 'INSTANCE').map((value) => ({
    nodeId: id(value.guid),
    symbolId: id(value.symbolData.symbolID),
    overrides: value.symbolData.symbolOverrides,
    interactions: (value.prototypeInteractions ?? []).map(interaction),
    runtimeSupport: 'NOT_IMPLEMENTED',
    runtimeReason: 'PublicationResponse has no social reaction state; the authored like interaction is not fabricated',
  })),
  prototypeInteractions: pageDescendants
    .filter((value) => value.prototypeInteractions?.length)
    .map((value) => ({
      nodeId: id(value.guid),
      interactions: value.prototypeInteractions.map(interaction),
    })),
};

const instance = node('825:6884');
const navigation = node('825:6984');
const copy = node('825:7034');
const preview = node('825:7032');
const availability = node('825:7041');
const row = node('825:7027');
const navigationInteraction = navigation.prototypeInteractions[0];

const ranking = {
  sourceFrameId: '825:6804',
  sourceFrameSize: formalFrame.size,
  sourceAudit: {
    requestedIdsAbsent: requestedIds.filter((requestedId) => !nodes.has(requestedId)),
    page: pageAudit,
    instance: {
      nodeId: '825:6884',
      symbolId: id(instance.symbolData.symbolID),
      overrides: instance.symbolData.symbolOverrides,
      interactions: instance.prototypeInteractions.map(interaction),
      overrideCount: instance.symbolData.symbolOverrides.length,
      interactionCount: instance.prototypeInteractions.length,
      runtimeSupport: 'NOT_IMPLEMENTED',
      runtimeReason: 'PublicationResponse has no social reaction state; the authored like interaction is not fabricated',
    },
    navigation: {
      nodeId: '825:6984',
      interactionId: id(navigationInteraction.id),
      interactionCount: navigation.prototypeInteractions.length,
      event: navigationInteraction.event.interactionType,
      actions: navigationInteraction.actions.map(action),
      runtimeSupport: 'NOT_IMPLEMENTED',
      runtimeReason: 'Expo Router navigation remains immediate; no source-timed visual route transition is available',
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
      borderColor: color(availability.strokePaints[0].color).hex,
    },
    dividerColor: color(row.strokePaints[0].color).hex,
  },
};

await fs.writeFile(
  process.env.INTELLIDEPLOY_EVIDENCE_OUTPUT ??
    new URL('../design/rankingRenderEvidence.ts', import.meta.url),
  `// Generated from the validated ranking40 frame; rows bind only existing Publication DTO fields.\nexport const rankingRenderEvidence=${JSON.stringify(ranking, null, 2)} as const;\n`,
);
