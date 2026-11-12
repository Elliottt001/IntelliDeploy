import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { extractMobileComponentEvidence } from "./extract-mobile-component-evidence.mjs";
const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
if (!source) throw Error("Set INTELLIDEPLOY_FIGMA_SOURCE");
const temporary = await mkdtemp(path.join(tmpdir(), "formal-mobile-controls-"));
try {
  const outputPath = path.join(temporary, "source.ts");
  await extractMobileComponentEvidence({
    designSource: source,
    outputPath,
    auditedRoots: { settings: ["270:26279"] },
    iconRoots: { settings: "270:26281" },
  });
  const module = await readFile(outputPath, "utf8");
  const primitives = JSON.parse(
    module.match(
      /export const figmaComponentEvidence = ([\s\S]*?) as const satisfies/,
    )[1],
  );
  const icons = JSON.parse(
    module.match(
      /export const figmaMobileIcons = ([\s\S]*?) as const satisfies/,
    )[1],
  );
  const document=JSON.parse(await readFile(path.join(source,'design-data/document.kiwi.json'),'utf8'));
  const node=id=>document.nodeChanges.find(n=>`${n.guid.sessionID}:${n.guid.localID}`===id);
  const offsets=(circleId,iconId)=>{const circle=node(circleId),icon=node(iconId),cx=circle.transform.m02+circle.size.x/2,cy=circle.transform.m12+circle.size.y/2;return{circleNodeId:circleId,iconNodeId:iconId,surfaceOffset:{x:3+cx-22,y:3+cy-22},iconOffset:{x:icon.transform.m02+icon.size.x/2-cx,y:icon.transform.m12+icon.size.y/2-cy}};};
  const header=node('825:5827'),collection=node('825:5846');
  const productHeader={sourceNodeId:'825:5827',size:header.size,transform:header.transform,collection:{sourceNodeId:'825:5846',transform:collection.transform},back:offsets('825:5829','825:5830'),share:offsets('825:5836','825:5837')};
  await writeFile(
    new URL("../design/formalMobileControls.ts", import.meta.url),
    `// Actual formal home settings node; symbol 248:20538 remains the audited arrow component in figmaComponentEvidence.\nexport const formalMobileControls = ${JSON.stringify({ settings: icons.settings, settingsNode: primitives.settings, productHeader }, null, 2)} as const;\n`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
