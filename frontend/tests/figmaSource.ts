import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type SourceMatrix = {
  m00: number;
  m01: number;
  m02: number;
  m10: number;
  m11: number;
  m12: number;
};

export type SourceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const identity: SourceMatrix = {
  m00: 1,
  m01: 0,
  m02: 0,
  m10: 0,
  m11: 1,
  m12: 0,
};

let nodeIndex: Map<string, Record<string, any>> | undefined;

const guid = (value: { sessionID: number; localID: number }) =>
  `${value.sessionID}:${value.localID}`;

function sourceRoot() {
  const root = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
  if (!root) {
    throw new Error('INTELLIDEPLOY_FIGMA_SOURCE is required for source checks');
  }
  return root;
}

export function sourceNode(nodeId: string): Record<string, any> {
  if (!nodeIndex) {
    const document = JSON.parse(
      readFileSync(
        join(sourceRoot(), 'design-data/document.kiwi.json'),
        'utf8',
      ),
    );
    nodeIndex = new Map(
      document.nodeChanges.map((node: Record<string, any>) => [
        guid(node.guid),
        node,
      ]),
    );
  }
  const node = nodeIndex.get(nodeId);
  if (!node) {
    throw new Error(`Missing source node ${nodeId}`);
  }
  return node;
}

function multiply(a: SourceMatrix, b: SourceMatrix): SourceMatrix {
  return {
    m00: a.m00 * b.m00 + a.m01 * b.m10,
    m01: a.m00 * b.m01 + a.m01 * b.m11,
    m02: a.m00 * b.m02 + a.m01 * b.m12 + a.m02,
    m10: a.m10 * b.m00 + a.m11 * b.m10,
    m11: a.m10 * b.m01 + a.m11 * b.m11,
    m12: a.m10 * b.m02 + a.m11 * b.m12 + a.m12,
  };
}

export function sourceBox(frameId: string, nodeId: string): SourceBox {
  const leaf = sourceNode(nodeId);
  const chain: SourceMatrix[] = [];
  let current = leaf;
  while (guid(current.guid) !== frameId) {
    chain.unshift(current.transform ?? identity);
    if (!current.parentIndex?.guid) {
      throw new Error(`Node ${nodeId} is outside the source frame ${frameId}`);
    }
    current = sourceNode(guid(current.parentIndex.guid));
  }

  const matrix = chain.reduce(multiply, identity);
  const width = leaf.size?.x ?? 0;
  const height = leaf.size?.y ?? 0;
  const points = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([x, y]) => ({
    x: matrix.m00 * x + matrix.m01 * y + matrix.m02,
    y: matrix.m10 * x + matrix.m11 * y + matrix.m12,
  }));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
