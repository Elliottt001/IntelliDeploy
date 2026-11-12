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
const images = {};
for (const id of [
  "845:3518",
  "845:3519",
  "845:3520",
  "845:3522",
  "846:3587",
  "849:3651",
  "849:3748",
  "849:3837",
  "849:3926",
  "849:4015",
  "852:4104",
  "852:4193",
  "852:4285",
  "852:4435",
]) {
  const n = node(id),
    p = n.fillPaints.find((p) => p.type === "IMAGE" && p.visible !== false);
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
const replyStyles=Object.fromEntries(Object.entries({short:'849:3672',detailed:'852:4241'}).map(([key,id])=>{
 const n=node(id),lineBaselines=[...new Set(n.derivedTextData.glyphs.map(g=>g.position.y))].sort((a,b)=>a-b);
 // Derived glyph rows preserve Figma's actual rounded line advances; the nominal percentage does not.
 const lineHeight=key==='short'?n.size.y:Math.min(...lineBaselines.slice(1).map((y,index)=>y-lineBaselines[index]));
 return [key,{sourceNodeId:id,fontSize:n.fontSize,lineHeight,lineBaselines,textColor:color(n.fillPaints[0].color)}];
}));
const shortReplyLayout={sourceNodeIds:['849:3948','849:3954','849:3960'],textOriginX:node('849:3948').transform.m02+node('849:3953').transform.m02,lineOffsets:['849:3948','849:3954','849:3960'].map(id=>node(id).transform.m12-node('849:3948').transform.m12)};
const lateReplyTextIds=['849:4048','849:4054','849:4060'],lateReplyOrigin=id=>{const n=node(id),p=node(`${n.parentIndex.guid.sessionID}:${n.parentIndex.guid.localID}`);return {x:p.transform.m02+n.transform.m02,y:p.transform.m12+n.transform.m12};};
const lateShortReplyLayout={sourceNodeIds:lateReplyTextIds,textOriginX:lateReplyOrigin(lateReplyTextIds[0]).x,offsetY:lateReplyOrigin(lateReplyTextIds[0]).y-node('849:3948').transform.m12,lineOffsets:lateReplyTextIds.map(id=>lateReplyOrigin(id).y-lateReplyOrigin(lateReplyTextIds[0]).y)};
const panel=node('852:4334'),panelText=node('852:4241');const replyPanel={sourceNodeId:'852:4334',size:panel.size,cornerRadius:panel.cornerRadius,backgroundColor:color(panel.fillPaints[0].color),shadow:panel.effects.find(e=>e.type==='DROP_SHADOW'),textPosition:panelText.transform,textSize:panelText.size,offsetY:panel.transform.m12-(node('849:3948').transform.m12-21)};
const successPanel=node('852:4517'),successText=node('852:4519'),excerptStart=successText.textData.characters.indexOf('环境依赖：'),excerptGlyph=successText.derivedTextData.glyphs.find(g=>g.firstCharacter===excerptStart),firstBaseline=Math.min(...successText.derivedTextData.glyphs.map(g=>g.position.y));
if(successPanel.visible===false||successText.visible===false||!excerptGlyph)throw Error('Visible success source excerpt required');
const successReplyPanel={sourceNodeId:'852:4517',sourceTextNodeId:'852:4519',sourceFrameId:'852:4391',size:successPanel.size,cornerRadius:successPanel.cornerRadius,backgroundColor:color(successPanel.fillPaints[0].color),shadow:successPanel.effects.find(e=>e.type==='DROP_SHADOW'),textPosition:{...successText.transform,m12:successText.transform.m12+excerptGlyph.position.y-firstBaseline},textSize:successText.size,excerptStart,excerptBaseline:excerptGlyph.position.y,offsetY:successPanel.transform.m12-(node('849:3948').transform.m12-21)};
const listGlyph=successText.derivedTextData.glyphs.find(g=>g.firstCharacter===undefined&&g.position.y>excerptGlyph.position.y),listTextGlyph=successText.derivedTextData.glyphs.find(g=>g.firstCharacter!==undefined&&g.position.y===listGlyph.position.y);
if(!successText.textData.lines.some(line=>line.lineType==='UNORDERED_LIST'))throw Error('Actual unordered paragraph source required');
const replyListBullet={sourceNodeId:'852:4519',sourceLineType:'UNORDERED_LIST',fontSize:listGlyph.fontSize,indent:listTextGlyph.position.x,x:listGlyph.position.x,path:glyphPath(listGlyph.commandsBlob),fill:color(successText.fillPaints[0].color)};
await fs.writeFile(
  new URL("../design/miboRenderEvidence.ts", import.meta.url),
  `// Actual formal Kiwi image UV and derived glyph geometry.\nexport const miboRenderEvidence = ${JSON.stringify({ images, text, replyStyles, shortReplyLayout, lateShortReplyLayout, replyPanel, successReplyPanel, replyListBullet }, null, 2)} as const;\n`,
);
