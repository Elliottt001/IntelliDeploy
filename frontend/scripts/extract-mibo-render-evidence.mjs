import fs from "node:fs/promises";
const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
if (!source) throw Error("Set INTELLIDEPLOY_FIGMA_SOURCE");
const document = JSON.parse(
  await fs.readFile(`${source}/design-data/document.kiwi.json`, "utf8"),
);
const node = (id) =>
  document.nodeChanges.find(
    (n) => `${n.guid.sessionID}:${n.guid.localID}` === id,
  );
const nodeId = (value) => `${value.guid.sessionID}:${value.guid.localID}`;
const parentId = (value) =>
  value.parentIndex?.guid
    ? `${value.parentIndex.guid.sessionID}:${value.parentIndex.guid.localID}`
    : null;
const frameIds = [
  "845:3479",
  "846:3544",
  "849:3608",
  "849:3705",
  "849:3794",
  "849:3883",
  "849:3972",
  "852:4061",
  "852:4150",
  "852:4242",
  "852:4391",
];
const children = new Map();
for (const value of document.nodeChanges) {
  const parent = parentId(value);
  if (parent) children.set(parent, [...(children.get(parent) ?? []), value]);
}
for (const values of children.values())
  values.sort((left, right) =>
    left.parentIndex.position < right.parentIndex.position ? -1 : 1,
  );
const subtree = (root) => {
  const values = [node(root)];
  for (let index = 0; index < values.length; index++)
    values.push(...(children.get(nodeId(values[index])) ?? []));
  return values;
};
const images = {};
const frames = {};
const rawFrames = {};
for (const frameId of frameIds) {
  const values = subtree(frameId),
    imageNodes = values.filter((value) =>
      value.fillPaints?.some(
        (paint) => paint.type === "IMAGE" && paint.visible !== false,
      ),
    );
  rawFrames[frameId] = values;
  for (const n of imageNodes) {
    const id = nodeId(n),
      p = n.fillPaints.find(
        (paint) => paint.type === "IMAGE" && paint.visible !== false,
      );
    images[id] = {
      sourceNodeId: id,
      visible: n.visible !== false,
      size: n.size,
      transform: n.transform,
      paintTransform: p.transform,
      blendMode: p.blendMode,
      opacity: (n.opacity ?? 1) * (p.opacity ?? 1),
      rawHash: Buffer.from(p.image.hash.data, "base64").toString("hex"),
    };
  }
  const interactions = values.flatMap((value) =>
    (value.prototypeInteractions ?? []).map((interaction) => ({
      sourceNodeId: nodeId(value),
      rawInteraction: interaction,
    })),
  );
  const effectTypes = Object.fromEntries(
    [
      ...new Set(
        values.flatMap((value) =>
          (value.effects ?? [])
            .filter((effect) => effect.visible !== false)
            .map((effect) => effect.type),
        ),
      ),
    ]
      .sort()
      .map((type) => [
        type,
        values.reduce(
          (count, value) =>
            count +
            (value.effects ?? []).filter(
              (effect) => effect.visible !== false && effect.type === type,
            ).length,
          0,
        ),
      ]),
  );
  const statusNode = values.find(
    (value) =>
      value.type === "TEXT" &&
      value.transform?.m12 === 382 &&
      value.visible !== false &&
      (value.opacity ?? 1) > 0,
  );
  frames[frameId] = {
    sourceFrameId: frameId,
    size: node(frameId).size,
    nodeCount: values.length,
    instanceNodeIds: values
      .filter((value) => value.type === "INSTANCE")
      .map(nodeId),
    symbolNodeIds: values
      .filter((value) => value.type === "SYMBOL")
      .map(nodeId),
    geometryNodeCount: values.filter(
      (value) => value.fillGeometry?.length || value.strokeGeometry?.length,
    ).length,
    paintNodeCount: values.filter(
      (value) => value.fillPaints?.length || value.strokePaints?.length,
    ).length,
    effectTypes,
    imageNodeIds: imageNodes.map(nodeId),
    statusNode: statusNode
      ? {
          sourceNodeId: nodeId(statusNode),
          size: statusNode.size,
          transform: statusNode.transform,
          opacity: statusNode.opacity ?? 1,
        }
      : null,
    interactions: interactions.map(({ sourceNodeId, rawInteraction }) => {
      const action = rawInteraction.actions?.[0];
      return {
        sourceNodeId,
        interactionId: `${rawInteraction.id.sessionID}:${rawInteraction.id.localID}`,
        event: rawInteraction.event,
        transitionNodeId: action?.transitionNodeID
          ? `${action.transitionNodeID.sessionID}:${action.transitionNodeID.localID}`
          : null,
        transitionType: action?.transitionType ?? null,
        transitionDuration: action?.transitionDuration ?? 0,
        easingType: action?.easingType ?? null,
        easingFunction: action?.easingFunction ?? [],
      };
    }),
  };
}
function glyphPath(index) {
  const bytes = Buffer.from(document.blobs[index].bytes.data, "base64");
  let offset = 0;
  const commands = [];
  while (offset < bytes.length) {
    const op = bytes[offset++],
      letter = { 0: "Z", 1: "M", 2: "L", 3: "Q", 4: "C" }[op];
    if (!letter) throw Error("Invalid glyph");
    const count = op === 0 ? 0 : op === 4 ? 6 : op === 3 ? 4 : 2;
    const values = Array.from({ length: count }, () => {
      const n = bytes.readFloatLE(offset);
      offset += 4;
      return Number(n.toFixed(6));
    });
    commands.push(`${letter}${values.join(" ")}`);
  }
  return commands.join(" ").replace(/^(?:Z\s*)+/, "");
}
const color = (c) =>
  "#" +
  [c.r, c.g, c.b]
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();
const text = {};
for (const id of ["845:3509", "845:3521", "845:3525", "845:3527", "845:3529"]) {
  const n = node(id);
  text[id] = {
    sourceNodeId: id,
    size: n.size,
    transform: n.transform,
    characters: n.textData.characters,
    glyphs: n.derivedTextData.glyphs.map((g) => {
      const styleID = n.textData.characterStyleIDs?.[g.firstCharacter] ?? 0;
      const style = n.textData.styleOverrideTable?.find(
        (s) => s.styleID === styleID,
      );
      const p = (style?.fillPaints ?? n.fillPaints).find(
        (p) => p.visible !== false,
      );
      return {
        path: glyphPath(g.commandsBlob),
        position: g.position,
        fontSize: g.fontSize,
        paint: p,
        fill: p.color ? color(p.color) : "none",
        opacity: (p.opacity ?? 1) * (p.color?.a ?? 1),
      };
    }),
  };
}
const replyStyles = Object.fromEntries(
  Object.entries({ short: "849:3672", detailed: "852:4241" }).map(
    ([key, id]) => {
      const n = node(id),
        lineBaselines = [
          ...new Set(n.derivedTextData.glyphs.map((g) => g.position.y)),
        ].sort((a, b) => a - b);
      // Derived glyph rows preserve Figma's actual rounded line advances; the nominal percentage does not.
      const lineHeight =
        key === "short"
          ? n.size.y
          : Math.min(
              ...lineBaselines
                .slice(1)
                .map((y, index) => y - lineBaselines[index]),
            );
      return [
        key,
        {
          sourceNodeId: id,
          fontSize: n.fontSize,
          lineHeight,
          lineBaselines,
          textColor: color(n.fillPaints[0].color),
        },
      ];
    },
  ),
);
const shortReplyLayout = {
  sourceNodeIds: ["849:3948", "849:3954", "849:3960"],
  textOriginX: node("849:3948").transform.m02 + node("849:3953").transform.m02,
  lineOffsets: ["849:3948", "849:3954", "849:3960"].map(
    (id) => node(id).transform.m12 - node("849:3948").transform.m12,
  ),
};
const lateReplyTextIds = ["849:4048", "849:4054", "849:4060"],
  lateReplyOrigin = (id) => {
    const n = node(id),
      p = node(`${n.parentIndex.guid.sessionID}:${n.parentIndex.guid.localID}`);
    return {
      x: p.transform.m02 + n.transform.m02,
      y: p.transform.m12 + n.transform.m12,
    };
  };
const lateShortReplyLayout = {
  sourceNodeIds: lateReplyTextIds,
  textOriginX: lateReplyOrigin(lateReplyTextIds[0]).x,
  offsetY:
    lateReplyOrigin(lateReplyTextIds[0]).y - node("849:3948").transform.m12,
  lineOffsets: lateReplyTextIds.map(
    (id) => lateReplyOrigin(id).y - lateReplyOrigin(lateReplyTextIds[0]).y,
  ),
};
const panel = node("852:4334"),
  panelText = node("852:4241");
const replyPanel = {
  sourceNodeId: "852:4334",
  size: panel.size,
  cornerRadius: panel.cornerRadius,
  backgroundColor: color(panel.fillPaints[0].color),
  shadow: panel.effects.find((e) => e.type === "DROP_SHADOW"),
  textPosition: panelText.transform,
  textSize: panelText.size,
  offsetY: panel.transform.m12 - (node("849:3948").transform.m12 - 21),
};
const successPanel = node("852:4517"),
  successText = node("852:4519"),
  excerptStart = successText.textData.characters.indexOf("环境依赖："),
  excerptGlyph = successText.derivedTextData.glyphs.find(
    (g) => g.firstCharacter === excerptStart,
  ),
  firstBaseline = Math.min(
    ...successText.derivedTextData.glyphs.map((g) => g.position.y),
  );
if (
  successPanel.visible === false ||
  successText.visible === false ||
  !excerptGlyph
)
  throw Error("Visible success source excerpt required");
const successReplyPanel = {
  sourceNodeId: "852:4517",
  sourceTextNodeId: "852:4519",
  sourceFrameId: "852:4391",
  size: successPanel.size,
  cornerRadius: successPanel.cornerRadius,
  backgroundColor: color(successPanel.fillPaints[0].color),
  shadow: successPanel.effects.find((e) => e.type === "DROP_SHADOW"),
  textPosition: {
    ...successText.transform,
    m12: successText.transform.m12 + excerptGlyph.position.y - firstBaseline,
  },
  textSize: successText.size,
  excerptStart,
  excerptBaseline: excerptGlyph.position.y,
  offsetY: successPanel.transform.m12 - (node("849:3948").transform.m12 - 21),
};
const listGlyph = successText.derivedTextData.glyphs.find(
    (g) =>
      g.firstCharacter === undefined && g.position.y > excerptGlyph.position.y,
  ),
  listTextGlyph = successText.derivedTextData.glyphs.find(
    (g) =>
      g.firstCharacter !== undefined && g.position.y === listGlyph.position.y,
  );
if (
  !successText.textData.lines.some((line) => line.lineType === "UNORDERED_LIST")
)
  throw Error("Actual unordered paragraph source required");
const replyListBullet = {
  sourceNodeId: "852:4519",
  sourceLineType: "UNORDERED_LIST",
  fontSize: listGlyph.fontSize,
  indent: listTextGlyph.position.x,
  x: listGlyph.position.x,
  path: glyphPath(listGlyph.commandsBlob),
  fill: color(successText.fillPaints[0].color),
};
const runtimeOutput =
  process.env.INTELLIDEPLOY_MIBO_RUNTIME_OUTPUT ??
  new URL("../design/miboRenderEvidence.ts", import.meta.url);
const auditOutput =
  process.env.INTELLIDEPLOY_MIBO_AUDIT_OUTPUT ??
  new URL("../design/miboSourceAudit.ts", import.meta.url);
if (
  Boolean(process.env.INTELLIDEPLOY_MIBO_RUNTIME_OUTPUT) !==
  Boolean(process.env.INTELLIDEPLOY_MIBO_AUDIT_OUTPUT)
)
  throw Error("Mibo runtime and audit outputs must be supplied together");
await Promise.all([
  fs.writeFile(
    runtimeOutput,
    `// Compact runtime evidence generated from the formal Kiwi Mibo frames.\nexport const miboRenderEvidence = ${JSON.stringify({ frames, images, text, replyStyles, shortReplyLayout, lateShortReplyLayout, replyPanel, successReplyPanel, replyListBullet }, null, 2)} as const;\n`,
  ),
  fs.writeFile(
    auditOutput,
    `// Audit-only raw Kiwi payloads. Production modules must not import this file.\nexport const miboSourceAudit = JSON.parse(${JSON.stringify(JSON.stringify({ frames: rawFrames }))}) as {frames:Record<string,Array<Record<string,unknown>>>};\n`,
  ),
]);
