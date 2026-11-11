import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const source =
  '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221';

const rootIds = [
  '119:76618',
  '270:26263',
  '188:16287',
  '188:16759',
  '266:21147',
  '268:22904',
  '268:23238',
  '268:23572',
  '268:23906',
  '270:26597',
  '825:6804',
  '845:3479',
  '846:3544',
  '849:3608',
  '849:3705',
  '849:3794',
  '849:3883',
  '849:3972',
  '852:4061',
  '852:4150',
  '852:4242',
  '852:4391',
  '168:6299',
  '380:147',
  '168:6358',
  '825:6452',
];

const nodeData = JSON.parse(
  await readFile(path.join(source, 'design-data/移动端UI.nodes.json'), 'utf8'),
);
const rawAssets = JSON.parse(
  await readFile(path.join(source, 'design-data/raw-assets.json'), 'utf8'),
);
const nodes = nodeData.nodes;

const nodeId = (node) => `${node.guid.sessionID}:${node.guid.localID}`;
const parentId = (node) =>
  node.parentIndex?.guid
    ? `${node.parentIndex.guid.sessionID}:${node.parentIndex.guid.localID}`
    : '';

const nodesById = new Map(nodes.map((node) => [nodeId(node), node]));
const childrenByParent = new Map();
for (const node of nodes) {
  const parent = parentId(node);
  childrenByParent.set(parent, [
    ...(childrenByParent.get(parent) ?? []),
    node,
  ]);
}

const selected = [];
const visit = (node) => {
  selected.push(node);
  for (const child of childrenByParent.get(nodeId(node)) ?? []) {
    visit(child);
  }
};

for (const rootId of rootIds) {
  const root = nodesById.get(rootId);
  if (!root) {
    throw new Error(`Missing approved frame ${rootId}`);
  }
  if (root.size?.x !== 375 || root.size?.y !== 812) {
    throw new Error(
      `Approved frame ${rootId} has unexpected size ${root.size?.x}x${root.size?.y}`,
    );
  }
  visit(root);
}

const rawAssetByHash = new Map(
  rawAssets.map((asset) => [path.basename(asset.archive_path), asset.local_path]),
);
const output = path.resolve('assets/mobile/generated');
const manifest = path.resolve('design/generated/mobileAssetManifest.ts');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(path.dirname(manifest), { recursive: true });

const records = [];
for (const node of selected) {
  for (const paint of node.fillPaints ?? []) {
    if (paint.type !== 'IMAGE' || !paint.image?.hash?.data) {
      continue;
    }

    const hash = Buffer.from(paint.image.hash.data, 'base64').toString('hex');
    const relativeSource = rawAssetByHash.get(hash);
    if (!relativeSource) {
      throw new Error(`Missing raw asset ${hash} for ${nodeId(node)}`);
    }

    const extension = path.extname(relativeSource);
    const fileName = `${nodeId(node).replace(':', '-')}-${hash}${extension}`;
    await copyFile(
      path.join(source, relativeSource),
      path.join(output, fileName),
    );
    records.push({
      key: `${nodeId(node)}:${records.length}`,
      nodeId: nodeId(node),
      name: node.name,
      file: `../../assets/mobile/generated/${fileName}`,
    });
  }
}

const entries = records
  .map(
    (record) =>
      `  ${JSON.stringify(record.key)}: { nodeId: ${JSON.stringify(record.nodeId)}, name: ${JSON.stringify(record.name)}, source: require(${JSON.stringify(record.file)}) },`,
  )
  .join('\n');
const moduleText = `declare const require: (path: string) => number;\nexport const mobileAssets = {\n${entries}\n} as const;\n`;
await writeFile(manifest, moduleText);

console.log(
  `Extracted ${records.length} image paints from ${rootIds.length} approved frames.`,
);
