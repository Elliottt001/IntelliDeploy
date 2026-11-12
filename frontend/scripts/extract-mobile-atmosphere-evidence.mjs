import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractMobileComponentEvidence } from "./extract-mobile-component-evidence.mjs";
const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
if (!source) throw Error("Set INTELLIDEPLOY_FIGMA_SOURCE");
const temporary = await mkdtemp(path.join(tmpdir(), "mobile-atmosphere-"));
try {
  const outputPath = path.join(temporary, "source.ts");
  await extractMobileComponentEvidence({
    designSource: source,
    outputPath,
    auditedRoots: { home: ["270:26264"] },
    iconRoots: {},
  });
  const module = await readFile(outputPath, "utf8");
  const primitive = JSON.parse(
    module.match(
      /export const figmaComponentEvidence = ([\s\S]*?) as const satisfies/,
    )[1],
  ).home;
  const document = JSON.parse(
    await readFile(path.join(source, "design-data/document.kiwi.json"), "utf8"),
  );
  const node = (id) =>
    document.nodeChanges.find(
      (n) => `${n.guid.sessionID}:${n.guid.localID}` === id,
    );
  const facts = (id) => {
    const n = node(id);
    return {
      sourceNodeId: id,
      size: n.size,
      transform: n.transform,
      opacity: n.opacity ?? 1,
      clipsContent: n.frameMaskDisabled === false,
      fillPaints: n.fillPaints ?? [],
    };
  };
  // The expanded personal card moves the same artwork. Fail regeneration if
  // a later source changes those leaves instead of silently reusing them.
  const artwork = (root) => document.nodeChanges
    .filter(n => n.parentIndex?.guid && `${n.parentIndex.guid.sessionID}:${n.parentIndex.guid.localID}` === root)
    .sort((a, b) => a.parentIndex.position < b.parentIndex.position ? -1 : 1)
    .map(n => ({ size: n.size, transform: n.transform, fillPaints: n.fillPaints, fillGeometry: n.fillGeometry, effects: n.effects, opacity: n.opacity, visible: n.visible }));
  if (JSON.stringify(artwork('270:26264')) !== JSON.stringify(artwork('268:23926'))) {
    throw Error('Expanded home profile atmosphere requires its own source artwork');
  }
  const evidence = {
    sourceRoots: ["270:26264", "845:3499", "268:23926", "168:6319", "168:6378"],
    background: facts("270:26263"),
    atmosphere: facts("270:26264"),
    chatbotAtmosphere: facts("845:3499"),
    profileAtmosphere: facts("268:23926"),
    geometry: primitive.geometry,
    effects: primitive.effects,
  };
  await writeFile(
    new URL("../design/mobileAtmosphereEvidence.ts", import.meta.url),
    `// Actual Kiwi geometry/paint, resolved by audited component extractor.\nexport const mobileAtmosphereEvidence = ${JSON.stringify(evidence, null, 2)} as const;\n`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
