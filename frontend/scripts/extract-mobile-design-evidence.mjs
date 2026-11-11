import { randomUUID } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const source =
  '/Users/bytedance/Downloads/IntelliDeploy-design-2026-11-10-2221';

export const approvedRootIds = [
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

const nodeId = (node) => `${node.guid.sessionID}:${node.guid.localID}`;
const parentId = (node) =>
  node.parentIndex?.guid
    ? `${node.parentIndex.guid.sessionID}:${node.parentIndex.guid.localID}`
    : '';

async function renameIfPresent(from, to, renamePath) {
  try {
    await renamePath(from, to);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function createManifest(records, manifestOutput, assetOutput) {
  const entries = records
    .map((record) => {
      const relativeAsset = path
        .relative(
          path.dirname(manifestOutput),
          path.join(assetOutput, record.fileName),
        )
        .split(path.sep)
        .join('/');
      const requirePath = relativeAsset.startsWith('.')
        ? relativeAsset
        : `./${relativeAsset}`;
      return `  ${JSON.stringify(record.key)}: { nodeId: ${JSON.stringify(record.nodeId)}, name: ${JSON.stringify(record.name)}, source: require(${JSON.stringify(requirePath)}) },`;
    })
    .join('\n');

  return `declare const require: (path: string) => number;\nexport const mobileAssets = {\n${entries}\n} as const;\n`;
}

async function createExtractionPlan({ designSource, rootIds }) {
  const nodeData = JSON.parse(
    await readFile(
      path.join(designSource, 'design-data/移动端UI.nodes.json'),
      'utf8',
    ),
  );
  const rawAssets = JSON.parse(
    await readFile(
      path.join(designSource, 'design-data/raw-assets.json'),
      'utf8',
    ),
  );
  if (!Array.isArray(nodeData.nodes) || !Array.isArray(rawAssets)) {
    throw new Error('Design evidence must contain nodes and raw asset arrays');
  }

  const nodesById = new Map(
    nodeData.nodes.map((node) => [nodeId(node), node]),
  );
  const childrenByParent = new Map();
  for (const node of nodeData.nodes) {
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
    rawAssets.map((asset) => [
      path.basename(asset.archive_path),
      asset.local_path,
    ]),
  );
  const records = [];
  for (const node of selected) {
    for (const paint of node.fillPaints ?? []) {
      if (paint.type !== 'IMAGE' || !paint.image?.hash?.data) {
        continue;
      }

      const hash = Buffer.from(paint.image.hash.data, 'base64').toString('hex');
      const relativeSource = rawAssetByHash.get(hash);
      if (!relativeSource) {
        throw new Error(`Missing raw asset mapping ${hash} for ${nodeId(node)}`);
      }

      const sourcePath = path.join(designSource, relativeSource);
      records.push({
        key: `${nodeId(node)}:${records.length}`,
        nodeId: nodeId(node),
        name: node.name,
        sourcePath,
        fileName: `${nodeId(node).replace(':', '-')}-${hash}${path.extname(relativeSource)}`,
      });
    }
  }

  const sourcePaths = [
    ...new Set(records.map((record) => record.sourcePath)),
  ];
  await Promise.all(sourcePaths.map((sourcePath) => access(sourcePath)));
  return records;
}

export async function extractMobileDesignEvidence({
  designSource = source,
  assetOutput = path.resolve('assets/mobile/generated'),
  manifestOutput = path.resolve('design/generated/mobileAssetManifest.ts'),
  renamePath = rename,
  rootIds = approvedRootIds,
} = {}) {
  const records = await createExtractionPlan({ designSource, rootIds });
  const moduleText = createManifest(records, manifestOutput, assetOutput);
  const suffix = `${process.pid}-${randomUUID()}`;
  const stagedAssets = `${assetOutput}.tmp-${suffix}`;
  const stagedManifest = `${manifestOutput}.tmp-${suffix}`;
  const backupAssets = `${assetOutput}.backup-${suffix}`;
  const backupManifest = `${manifestOutput}.backup-${suffix}`;

  await mkdir(path.dirname(assetOutput), { recursive: true });
  await mkdir(path.dirname(manifestOutput), { recursive: true });
  await mkdir(stagedAssets, { recursive: true });

  try {
    for (const record of records) {
      await copyFile(
        record.sourcePath,
        path.join(stagedAssets, record.fileName),
      );
    }
    await writeFile(stagedManifest, moduleText);
  } catch (error) {
    await rm(stagedAssets, { recursive: true, force: true });
    await rm(stagedManifest, { force: true });
    throw error;
  }

  let oldAssetsMoved = false;
  let oldManifestMoved = false;
  let newAssetsInstalled = false;
  let newManifestInstalled = false;
  try {
    oldAssetsMoved = await renameIfPresent(
      assetOutput,
      backupAssets,
      renamePath,
    );
    oldManifestMoved = await renameIfPresent(
      manifestOutput,
      backupManifest,
      renamePath,
    );
    await renamePath(stagedAssets, assetOutput);
    newAssetsInstalled = true;
    await renamePath(stagedManifest, manifestOutput);
    newManifestInstalled = true;
  } catch (error) {
    if (newManifestInstalled) {
      await rm(manifestOutput, { force: true });
    }
    if (newAssetsInstalled) {
      await rm(assetOutput, { recursive: true, force: true });
    }
    if (oldManifestMoved) {
      await renamePath(backupManifest, manifestOutput);
    }
    if (oldAssetsMoved) {
      await renamePath(backupAssets, assetOutput);
    }
    await rm(stagedAssets, { recursive: true, force: true });
    await rm(stagedManifest, { force: true });
    throw error;
  }

  await rm(backupAssets, { recursive: true, force: true });
  await rm(backupManifest, { force: true });
  return {
    assets: records.map(({ key, nodeId, name, fileName }) => ({
      key,
      nodeId,
      name,
      fileName,
    })),
    frameCount: rootIds.length,
    recordCount: records.length,
  };
}

const isEntryPoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntryPoint) {
  const result = await extractMobileDesignEvidence();
  console.log(
    `Extracted ${result.recordCount} image paints from ${result.frameCount} approved frames.`,
  );
}
