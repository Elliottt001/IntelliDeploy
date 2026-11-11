import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { extractMobileDesignEvidence } from '../scripts/extract-mobile-design-evidence.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createDesignFixture({
  approvedFrameSize = { x: 375, y: 812 },
  missingApprovedAsset = false,
} = {}) {
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), 'mobile-design-extraction-'),
  );
  temporaryDirectories.push(temporaryRoot);

  const source = path.join(temporaryRoot, 'design-source');
  const frontend = path.join(temporaryRoot, 'frontend');
  const generatedAssets = path.join(frontend, 'assets/mobile/generated');
  const manifest = path.join(
    frontend,
    'design/generated/mobileAssetManifest.ts',
  );
  const approvedHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const outsiderHash = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

  await mkdir(path.join(source, 'design-data'), { recursive: true });
  await mkdir(path.join(source, 'raw-assets'), { recursive: true });
  if (!missingApprovedAsset) {
    await writeFile(
      path.join(source, `raw-assets/${approvedHash}.png`),
      'approved image',
    );
  }
  await writeFile(
    path.join(source, `raw-assets/${outsiderHash}.png`),
    'outsider image',
  );
  await writeFile(
    path.join(source, 'design-data/移动端UI.nodes.json'),
    JSON.stringify({
      nodes: [
        {
          guid: { sessionID: 1, localID: 1 },
          parentIndex: { guid: { sessionID: 0, localID: 0 } },
          type: 'FRAME',
          name: 'Approved frame',
          size: approvedFrameSize,
        },
        {
          guid: { sessionID: 1, localID: 2 },
          parentIndex: { guid: { sessionID: 1, localID: 1 } },
          type: 'GROUP',
          name: 'Approved group',
        },
        {
          guid: { sessionID: 1, localID: 3 },
          parentIndex: { guid: { sessionID: 1, localID: 2 } },
          type: 'RECTANGLE',
          name: 'Approved image',
          fillPaints: [
            {
              type: 'IMAGE',
              image: {
                hash: {
                  data: Buffer.from(approvedHash, 'hex').toString('base64'),
                },
              },
            },
          ],
        },
        {
          guid: { sessionID: 2, localID: 1 },
          parentIndex: { guid: { sessionID: 0, localID: 0 } },
          type: 'FRAME',
          name: 'Outsider frame',
          size: { x: 375, y: 812 },
        },
        {
          guid: { sessionID: 2, localID: 2 },
          parentIndex: { guid: { sessionID: 2, localID: 1 } },
          type: 'RECTANGLE',
          name: 'Outsider image',
          fillPaints: [
            {
              type: 'IMAGE',
              image: {
                hash: {
                  data: Buffer.from(outsiderHash, 'hex').toString('base64'),
                },
              },
            },
          ],
        },
      ],
    }),
  );
  await writeFile(
    path.join(source, 'design-data/raw-assets.json'),
    JSON.stringify([
      {
        archive_path: `images/${approvedHash}`,
        local_path: `raw-assets/${approvedHash}.png`,
      },
      {
        archive_path: `images/${outsiderHash}`,
        local_path: `raw-assets/${outsiderHash}.png`,
      },
    ]),
  );

  return {
    approvedHash,
    frontend,
    generatedAssets,
    manifest,
    source,
  };
}

test('a missing source asset leaves the previous generated output intact', async () => {
  const { generatedAssets, manifest, source } = await createDesignFixture({
    missingApprovedAsset: true,
  });
  await mkdir(generatedAssets, { recursive: true });
  await mkdir(path.dirname(manifest), { recursive: true });
  await writeFile(path.join(generatedAssets, 'keep.txt'), 'previous asset');
  await writeFile(manifest, 'previous manifest');

  await expect(
    extractMobileDesignEvidence({
      designSource: source,
      assetOutput: generatedAssets,
      manifestOutput: manifest,
      rootIds: ['1:1'],
    }),
  ).rejects.toThrow();
  await expect(readFile(path.join(generatedAssets, 'keep.txt'), 'utf8')).resolves.toBe(
    'previous asset',
  );
  await expect(readFile(manifest, 'utf8')).resolves.toBe('previous manifest');
});

test('an invalid approved frame leaves the previous generated output intact', async () => {
  const { generatedAssets, manifest, source } = await createDesignFixture({
    approvedFrameSize: { x: 390, y: 844 },
  });
  await mkdir(generatedAssets, { recursive: true });
  await mkdir(path.dirname(manifest), { recursive: true });
  await writeFile(path.join(generatedAssets, 'keep.txt'), 'previous asset');
  await writeFile(manifest, 'previous manifest');

  await expect(
    extractMobileDesignEvidence({
      designSource: source,
      assetOutput: generatedAssets,
      manifestOutput: manifest,
      rootIds: ['1:1'],
    }),
  ).rejects.toThrow('unexpected size 390x844');
  await expect(readFile(path.join(generatedAssets, 'keep.txt'), 'utf8')).resolves.toBe(
    'previous asset',
  );
  await expect(readFile(manifest, 'utf8')).resolves.toBe('previous manifest');
});

test('extracts only approved descendants into a require manifest', async () => {
  const { approvedHash, generatedAssets, manifest, source } =
    await createDesignFixture();

  const result = await extractMobileDesignEvidence({
    designSource: source,
    assetOutput: generatedAssets,
    manifestOutput: manifest,
    rootIds: ['1:1'],
  });

  expect(result).toMatchObject({
    frameCount: 1,
    recordCount: 1,
    assets: [
      {
        key: '1:3:0',
        nodeId: '1:3',
        name: 'Approved image',
        fileName: `1-3-${approvedHash}.png`,
      },
    ],
  });
  expect(await readdir(generatedAssets)).toEqual([
    `1-3-${approvedHash}.png`,
  ]);
  await expect(
    readFile(path.join(generatedAssets, `1-3-${approvedHash}.png`), 'utf8'),
  ).resolves.toBe('approved image');

  const manifestText = await readFile(manifest, 'utf8');
  expect(manifestText).toContain('export const mobileAssets = {');
  expect(manifestText).toContain('"1:3:0": { nodeId: "1:3"');
  expect(manifestText).toContain(
    `source: require("../../assets/mobile/generated/1-3-${approvedHash}.png")`,
  );
  expect(manifestText).not.toContain('2:2');
});

test('produces identical assets and manifest across repeated runs', async () => {
  const { generatedAssets, manifest, source } = await createDesignFixture();
  const options = {
    designSource: source,
    assetOutput: generatedAssets,
    manifestOutput: manifest,
    rootIds: ['1:1'],
  };

  await extractMobileDesignEvidence(options);
  const firstFiles = await readdir(generatedAssets);
  const firstAssets = await Promise.all(
    firstFiles.map((file) => readFile(path.join(generatedAssets, file))),
  );
  const firstManifest = await readFile(manifest);

  await extractMobileDesignEvidence(options);

  expect(await readdir(generatedAssets)).toEqual(firstFiles);
  expect(
    await Promise.all(
      firstFiles.map((file) => readFile(path.join(generatedAssets, file))),
    ),
  ).toEqual(firstAssets);
  expect(await readFile(manifest)).toEqual(firstManifest);
});
