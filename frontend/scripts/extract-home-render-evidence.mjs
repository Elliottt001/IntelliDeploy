import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractMobileComponentEvidence, normalizeSourceEffect } from "./extract-mobile-component-evidence.mjs";
const source = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
if (!source) throw Error("Set INTELLIDEPLOY_FIGMA_SOURCE");
const doc = JSON.parse(
    await readFile(path.join(source, "design-data/document.kiwi.json"), "utf8"),
  ),
  id = (g) => `${g.sessionID}:${g.localID}`,
  nodes = new Map(doc.nodeChanges.map((n) => [id(n.guid), n]));
const children = new Map();
for (const n of doc.nodeChanges) {
  if (n.parentIndex?.guid) {
    const p = id(n.parentIndex.guid);
    children.set(p, [...(children.get(p) || []), id(n.guid)]);
  }
}
const subtree = (root) => {
  const set = new Set([root]);
  for (const k of set) for (const c of children.get(k) || []) set.add(c);
  return [...set];
};
const temporary = await mkdtemp(path.join(tmpdir(), "home-render-source-"));
try {
  const cloudBgIds = ["270:26263", "188:16759"]
    .map((frame) => {
      const cloud = subtree(frame)
        .map((k) => nodes.get(k))
        .find(
          (n) =>
            n.type === "FRAME" &&
            Math.round(n.size?.x ?? 0) === 303 &&
            Math.round(n.size?.y ?? 0) === 111,
        );
      return subtree(id(cloud.guid))
        .map((k) => nodes.get(k))
        .find(
          (n) =>
            n.type === "ROUNDED_RECTANGLE" &&
            n.fillPaints?.some((p) => p.type === "GRADIENT_RADIAL"),
        ).guid;
    })
    .map(id);
  const outputPath = path.join(temporary, "source.ts");
  await extractMobileComponentEvidence({
    designSource: source,
    outputPath,
    auditedRoots: {
      back: cloudBgIds,
      home: ["270:26291"],
      send: ["188:16338"],
      search: ["270:26290"],
      store: ["270:26347"],
      products: ["270:26433"],
      community: ["270:26462"],
      settings:["270:26466"],share:["270:26467"],bell:["270:26472"],microphone:["270:26473"],circleAction:["270:26478"],brandMark:["270:26479"],
      arrowRight: ["270:26311"],
      glassCard: ["270:26506"],
      bottomNav: ["268:23090"], // Existing extractor adapter; this source is the bag front.
    },
    iconRoots: {},
  });
  const module = await readFile(outputPath, "utf8"),
    p = JSON.parse(
      module.match(
        /export const figmaComponentEvidence = ([\s\S]*?) as const satisfies/,
      )[1],
    );
  const world = (nodeId, rootId) => {
    const chain = [];
    let n = nodes.get(nodeId);
    while (id(n.guid) !== rootId) {
      chain.unshift(n.transform);
      n = nodes.get(id(n.parentIndex.guid));
    }
    let t = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
    for (const v of chain) {
      t = {
        m00: t.m00 * v.m00 + t.m01 * v.m10,
        m01: t.m00 * v.m01 + t.m01 * v.m11,
        m02: t.m00 * v.m02 + t.m01 * v.m12 + t.m02,
        m10: t.m10 * v.m00 + t.m11 * v.m10,
        m11: t.m10 * v.m01 + t.m11 * v.m11,
        m12: t.m10 * v.m02 + t.m11 * v.m12 + t.m12,
      };
    }
    return t;
  };
  const paintOrder = [];
  const visit = (root) => {
    paintOrder.push(root);
    for (const k of (children.get(root) || []).sort((a, b) => {
      const x = nodes.get(a).parentIndex.position,
        y = nodes.get(b).parentIndex.position;
      return x < y ? -1 : x > y ? 1 : 0;
    }))
      visit(k);
  };
  visit("270:26291");
  p.home.geometry.sort(
    (a, b) =>
      paintOrder.indexOf(a.sourceNodeId) - paintOrder.indexOf(b.sourceNodeId),
  );
  p.home.geometry = p.home.geometry.map((layer) => ({
    ...layer,
    sourceEffects:
      nodes
        .get(layer.sourceNodeId)
        .effects?.map((e) => normalizeSourceEffect(e, layer.sourceNodeId))
        .filter(Boolean) ?? [],
  }));
  paintOrder.length=0;visit('188:16338');p.send.geometry.sort((a,b)=>paintOrder.indexOf(a.sourceNodeId)-paintOrder.indexOf(b.sourceNodeId));
  p.send.geometry=p.send.geometry.flatMap(layer=>{const n=nodes.get(layer.sourceNodeId),current={...layer,sourceEffects:n.effects?.map(e=>normalizeSourceEffect(e,layer.sourceNodeId)).filter(Boolean)??[]};if(layer.sourceNodeId!=='188:16340'||layer.fill!=='#D9D9D9')return [current];const paint=n.fillPaints.find(p=>p.type==='GRADIENT_LINEAR'),hex=c=>'#'+[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase();return [{...current,fill:undefined,opacity:paint.opacity??1,paint:{type:paint.type,opacity:paint.opacity??1,variableIds:[],transform:`matrix(${paint.transform.m00} ${paint.transform.m10} ${paint.transform.m01} ${paint.transform.m11} ${paint.transform.m02} ${paint.transform.m12})`,gradientStops:paint.stops.map(s=>({position:s.position,color:hex(s.color),opacity:s.color.a??1,variableIds:[]}))}},current];});
  const decorations={community:['settings','share','bell','microphone','circleAction','brandMark'].map(key=>{const primitive=p[key];paintOrder.length=0;visit(primitive.surfaceNodeId);primitive.geometry.sort((a,b)=>paintOrder.indexOf(a.sourceNodeId)-paintOrder.indexOf(b.sourceNodeId));return {...primitive,nodeTransform:nodes.get(primitive.surfaceNodeId).transform};})};
  const cards = {};
  for (const [key, primitive] of Object.entries({
    store: p.store,
    products: p.products,
    community: p.community,
    profile: p.glassCard,
  }))
    cards[key] = {
      ...primitive,
      nodeTransform: nodes.get(primitive.surfaceNodeId).transform,
      geometry: primitive.geometry.filter(g=>g.sourceNodeId===primitive.surfaceNodeId).map(g=>({...g,sourceEffects:nodes.get(g.sourceNodeId).effects?.map(e=>normalizeSourceEffect(e,g.sourceNodeId)).filter(Boolean)??[]})),
    };
  const storeFold = {
    sourceNodeId: '268:23090',
    size: nodes.get('268:23090').size,
    nodeTransform: world('268:23090', '268:23005'),
    effects: nodes.get('268:23090').effects?.filter(e => e.visible !== false) ?? [],
    // Leaf-root extraction retains its local transform. The composed card
    // transform above already contains it; apply it once.
    geometry: p.bottomNav.geometry.filter(g => g.sourceNodeId === '268:23090').map(g => ({ ...g, transform: undefined })),
  };
  function glyphPath(i) {
    const b = Buffer.from(doc.blobs[i].bytes.data, "base64");
    let at = 0;
    const out = [];
    while (at < b.length) {
      const op = b[at++],
        letter = { 0: "Z", 1: "M", 2: "L", 3: "Q", 4: "C" }[op];
      if (!letter) throw Error("Invalid glyph");
      const count = op === 0 ? 0 : op === 4 ? 6 : op === 3 ? 4 : 2;
      out.push(
        letter +
          Array.from({ length: count }, () => {
            const v = b.readFloatLE(at);
            at += 4;
            return Number(v.toFixed(6));
          }).join(" "),
      );
    }
    return out.join(" ").replace(/^(?:Z\s*)+/, "");
  }
  const hex = (c) =>
    "#" +
    [c.r, c.g, c.b]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase();
  const text = (n) => ({
    sourceNodeId: id(n.guid),
    characters: n.textData.characters,
    size: n.size,
    transform: n.transform,
    fontName: n.fontName,
    fontSize: n.fontSize,
    glyphs: n.derivedTextData.glyphs.map((g) => {
      const styleId = n.textData.characterStyleIDs?.[g.firstCharacter] ?? 0,
        style = n.textData.styleOverrideTable?.find(
          (s) => s.styleID === styleId,
        ),
        paint = (style?.fillPaints ?? n.fillPaints).find(
          (p) => p.visible !== false,
        );
      return {
        path: glyphPath(g.commandsBlob),
        position: g.position,
        fontSize: g.fontSize,
        fill: paint.color ? hex(paint.color) : "none",
        opacity:
          (paint.opacity ?? 1) * (paint.color?.a ?? 1) * (n.opacity ?? 1),
        paint,
      };
    }),
  });
  const clouds = [];
  for (const frameId of ["270:26263", "188:16759"]) {
    const members = subtree(frameId);
    const cloud = members
      .map((k) => nodes.get(k))
      .find(
        (n) =>
          n.type === "FRAME" &&
          Math.round(n.size?.x ?? 0) === 303 &&
          Math.round(n.size?.y ?? 0) === 111,
      );
    if (!cloud) throw Error(`Missing source cloud in ${frameId}`);
    const rootId = id(cloud.guid);
    const facts = subtree(rootId).map((k) => nodes.get(k));
    if (facts.some((n) => n.type === "INSTANCE" || n.type === "SYMBOL"))
      throw Error("Resolve cloud symbols");
    const bgId = cloudBgIds[clouds.length];
    clouds.push({
      frameId,
      sourceNodeId: rootId,
      background: {
        geometry: p.back.geometry.filter((g) => g.sourceNodeId === bgId).map((g)=>({...g,sourceEffects:nodes.get(g.sourceNodeId).effects?.map(e=>normalizeSourceEffect(e,g.sourceNodeId)).filter(Boolean)??[]})),
        nodeTransform: nodes.get(bgId).transform,
      },
      noSymbolReason: "no-instance-or-symbol-in-actual-cloud-subtree",
      items: facts
        .filter(
          (n) =>
            n.type === "TEXT" &&
            n.visible !== false &&
            n.derivedTextData?.glyphs,
        )
        .map(text),
    });
  }
  const cardCopy = Object.fromEntries(Object.entries({store:["270:26345","270:26349","270:26350"],products:["270:26431","270:26434","270:26435"],community:["270:26460","270:26464","270:26465"]}).map(([key,[root,title,description]])=>[key,{title:{...text(nodes.get(title)),transform:world(title,root)},description:{...text(nodes.get(description)),transform:world(description,root)}}]));
  const renderTree=(root,primitive)=>{const build=(n,inherited=1,inheritedVisible=true)=>({sourceNodeId:id(n.guid),size:n.size,transform:n.transform,opacity:n.opacity??1,visible:inheritedVisible&&n.visible!==false,clipsContent:n.type==='FRAME'&&n.frameMaskDisabled===false,mask:n.mask===true,booleanOperation:n.type==='BOOLEAN_OPERATION',blendMode:n.blendMode??'NORMAL',cornerRadius:n.cornerRadius??0,maskPaths:(n.fillGeometry??[]).map(g=>({path:glyphPath(g.commandsBlob),fillRule:g.windingRule==='ODD'?'evenodd':'nonzero'})),effects:n.effects?.map(e=>normalizeSourceEffect(e,id(n.guid))).filter(Boolean)??[],geometry:primitive.geometry.filter(g=>g.sourceNodeId===id(n.guid)).map(g=>({...g,opacity:g.opacity/(inherited*(n.opacity??1)||1),transform:undefined,sourceEffects:[]})),children:(children.get(id(n.guid))??[]).sort((a,b)=>nodes.get(a).parentIndex.position<nodes.get(b).parentIndex.position?-1:1).map(k=>build(nodes.get(k),inherited*(n.opacity??1),inheritedVisible&&n.visible!==false))});return build(nodes.get(root));};
  const avatarTrees={normal:renderTree('270:26291',p.home),pressed:renderTree('188:16338',p.send)};
  const manifest = await readFile(
    new URL("../design/generated/mobileAssetManifest.ts", import.meta.url),
    "utf8",
  );
  const assetFor = (hash) => {
    const row = manifest.split("\n").find((line) => line.includes(hash));
    if (!row) throw Error(`Missing tracked local asset ${hash}`);
    return row.match(/nodeId: "([^"]+)"/)[1];
  };
  const effectiveOpacity = (nodeId, rootId) => {
    let opacity = 1,
      n = nodes.get(nodeId);
    while (n) {
      opacity *= n.visible === false ? 0 : (n.opacity ?? 1);
      if (id(n.guid) === rootId) break;
      n = nodes.get(id(n.parentIndex.guid));
    }
    return opacity;
  };
  const images = [];
  for (const rootId of ["270:26431", "270:26504", "268:23425", "268:24166"])
    for (const k of subtree(rootId)) {
      const n = nodes.get(k);
      for (const paint of n.fillPaints ?? []) {
        if (
          n.visible === false ||
          paint.visible === false ||
          paint.type !== "IMAGE"
        )
          continue;
        const hash = Buffer.from(paint.image.hash.data, "base64").toString(
          "hex",
        );
        if (
          ![
            "8482368cbe35b3c650d59d6ddd843287d5f1855a",
            "50840ff5e6d01c9d277b126da700a168a7665949",
            "6f143a8ea37147536fafdf1ce19c36a5ee4340ec",
          ].includes(hash)
        )
          continue;
        images.push({
          rootId,
          sourceNodeId: k,
          assetNodeId: assetFor(hash),
          hash,
          size: n.size,
          transform: world(k, rootId),
          cornerRadius: n.cornerRadius ?? 0,
          clipPaths: (n.fillGeometry ?? []).map((g) => ({
            path: glyphPath(g.commandsBlob),
            fillRule: g.windingRule === "ODD" ? "evenodd" : "nonzero",
          })),
          opacity: effectiveOpacity(k, rootId) * (paint.opacity ?? 1),
          paintTransform: paint.transform,
        });
      }
    }
  const homeStates = [
    ["store", "266:21248", "268:22904", "268:23005"],
    ["products", "266:21339", "268:23238", "268:23425"],
    ["community", "266:21373", "268:23572", "268:23788"],
    ["profile", "268:22898", "268:23906", "268:24166"],
  ].map(([card, closedNodeId, expandedFrameId, expandedNodeId]) => ({
    card,
    closedNodeId,
    expandedFrameId,
    expandedNodeId,
    sourceY: {
      closed: world(closedNodeId, "266:21147").m12,
      expanded: world(expandedNodeId, expandedFrameId).m12,
    },
  }));
  await writeFile(
    process.env.INTELLIDEPLOY_HOME_RENDER_OUTPUT
      ? path.resolve(process.env.INTELLIDEPLOY_HOME_RENDER_OUTPUT)
      : new URL("../design/homeRenderEvidence.ts", import.meta.url),
    `// Actual Kiwi primitives, visible static glyphs and classified standalone illustration sources.\nexport const homeRenderEvidence = ${JSON.stringify({ question:text(nodes.get("270:26289")),greetingMetrics:{sourceNodeId:"270:26288",baseline:nodes.get("270:26288").derivedTextData.glyphs[0].position.y}, sourceEffectSamples:{storeSearchSurface:{sourceNodeId:"270:26624",effects:nodes.get("270:26624").effects?.map(e=>normalizeSourceEffect(e,"270:26624")).filter(Boolean)??[]}}, homeStates, avatarTrees, cardCopy, decorations, storeFold, sectionIcon:p.arrowRight,sectionLabels:{inspiration:text(nodes.get("270:26312")),functions:text(nodes.get("270:26317")),refresh:text(nodes.get("270:26313"))}, avatar: p.home, avatarPressed: p.send, avatarPressedTransform: nodes.get("188:16338").transform, miboLink:p.search, cards, clouds, images }, null, 2)} as const;\n`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
