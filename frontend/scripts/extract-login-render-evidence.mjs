import path from "node:path";
import { tmpdir } from "node:os";
import { extractMobileComponentEvidence } from "./extract-mobile-component-evidence.mjs";
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
const visiblePaint = (paints) => paints.find((p) => p.visible !== false);
const summarizePaint = (paint) => ({
  type: paint.type,
  color: paint.color ? color(paint.color) : "none",
  opacity: paint.opacity ?? 1,
});
const inputSurface = (surfaceId, textId) => {
  const surface = node(surfaceId);
  const label = node(textId);
  const glyph = label.derivedTextData.glyphs[0];
  return {
    surface: {
      sourceNodeId: surfaceId,
      size: surface.size,
      transform: surface.transform,
      cornerRadius: surface.cornerRadius,
      strokeWeight: surface.strokeWeight,
      strokeAlign: surface.strokeAlign,
      fill: summarizePaint(visiblePaint(surface.fillPaints)),
      stroke: summarizePaint(visiblePaint(surface.strokePaints)),
    },
    text: {
      sourceNodeId: textId,
      characters: label.textData.characters,
      size: label.size,
      transform: label.transform,
      fontSize: glyph.fontSize,
      baseline: glyph.position.y,
      fill: summarizePaint(visiblePaint(label.fillPaints)),
    },
  };
};
const text = {};
for (const id of ["119:76680", "119:76681", "119:76683", "119:76684"]) {
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
const temporary = await fs.mkdtemp(path.join(tmpdir(), "login-render-source-"));
try {
  const outputPath = path.join(temporary, "source.ts");
  await extractMobileComponentEvidence({
    designSource: source,
    outputPath,
    auditedRoots: { back: ["119:76698"], home:["119:76623"] },
    iconRoots: {},
  });
  const module = await fs.readFile(outputPath, "utf8");
  const p = JSON.parse(
    module.match(
      /export const figmaComponentEvidence = ([\s\S]*?) as const satisfies/,
    )[1],
  );
  const order = [
    "119:76698",
    ...document.nodeChanges
      .filter(
        (n) =>
          n.parentIndex?.guid?.sessionID === 119 &&
          n.parentIndex.guid.localID === 76698,
      )
      .sort((a, b) =>
        a.parentIndex.position < b.parentIndex.position ? -1 : 1,
      )
      .map((n) => `119:${n.guid.localID}`),
  ];
  const geometry = p.back.geometry
    .sort(
      (a, b) => order.indexOf(a.sourceNodeId) - order.indexOf(b.sourceNodeId),
    )
    .flatMap((layer) => {
      const n = node(layer.sourceNodeId);
      const effects = n.effects?.filter((e) => e.visible !== false) ?? [];
      const sourced = { ...layer, sourceSize: n.size, sourceEffects: effects };
      if (layer.sourceNodeId !== "119:76698") return [sourced];
      const paint = n.fillPaints[1];
      return [
        {
          ...sourced,
          fill: color(paint.color),
          paint: {
            type: "SOLID",
            color: color(paint.color),
            opacity: paint.opacity ?? 1,
            variableIds: [],
          },
          opacity: paint.opacity ?? 1,
        },
        { ...sourced, sourceEffects: [] },
      ];
    });
  const id=n=>`${n.guid.sessionID}:${n.guid.localID}`;
  const tree=(n,inherited=1)=>({sourceNodeId:id(n),size:n.size,transform:n.transform,opacity:n.opacity??1,visible:n.visible!==false,clipsContent:n.type==='FRAME'&&n.frameMaskDisabled===false,mask:n.mask===true,booleanOperation:n.type==='BOOLEAN_OPERATION',maskPaths:(n.fillGeometry??[]).map(g=>({path:glyphPath(g.commandsBlob),fillRule:g.windingRule==='ODD'?'evenodd':'nonzero'})),effects:n.effects?.filter(e=>e.visible!==false)??[],geometry:p.home.geometry.filter(g=>g.sourceNodeId===id(n)).map(g=>({...g,opacity:g.opacity/(inherited*(n.opacity??1)||1),transform:undefined,sourceEffects:[]})),children:document.nodeChanges.filter(c=>c.parentIndex?.guid&&`${c.parentIndex.guid.sessionID}:${c.parentIndex.guid.localID}`===id(n)).sort((a,b)=>a.parentIndex.position<b.parentIndex.position?-1:1).map(c=>tree(c,inherited*(n.opacity??1)))});
  const hero=tree(node('119:76623'));
  const social=Object.fromEntries(Object.entries({google:'119:76727',github:'119:76724',apple:'119:76721'}).map(([key,id])=>{const n=node(id),paint=n.fillPaints.find(p=>p.type==='IMAGE');return [key,{sourceNodeId:id,size:n.size,transform:n.transform,paintTransform:paint.transform,rawHash:Buffer.from(paint.image.hash.data,'base64').toString('hex')}];}));
  await fs.writeFile(
    new URL("../design/loginRenderEvidence.ts", import.meta.url),
    `// Actual login glyphs and native button geometry with recorded optical effects.\nexport const loginRenderEvidence = ${JSON.stringify({ social, hero, text, input: { sourceNodeId: "119:76685", size: node("119:76685").size, transform: node("119:76685").transform, account: inputSurface("119:76686", "119:76687"), password: inputSurface("119:76688", "119:76689") }, button: { sourceNodeId: "119:76698", size: node("119:76698").size, geometry } }, null, 2)} as const;\n`,
  );
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
