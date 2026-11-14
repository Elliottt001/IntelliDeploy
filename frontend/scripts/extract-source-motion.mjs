import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const defaultOutputPath = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../design/sourceMotionEvidence.ts',
);

const guid = (value) => `${value.sessionID}:${value.localID}`;
const interactionKey = (value) => guid(value.id);

export function mergeInteractions(inherited, own, overrides) {
  const effective = new Map();
  for (const group of [inherited, own, overrides]) {
    for (const value of group) {
      const key = interactionKey(value);
      if (value.isDeleted) {
        effective.delete(key);
      } else {
        effective.set(key, value);
      }
    }
  }
  return [...effective.values()];
}

async function defaultFrameIds() {
  const module = await import('../design/mobileEvidence.ts');
  return module.mobileApprovedFrameIds;
}

async function loadDocument(designSource) {
  const document = JSON.parse(
    await readFile(
      path.join(designSource, 'design-data/document.kiwi.json'),
      'utf8',
    ),
  );
  const nodes = document.nodeChanges ?? [];
  const nodesById = new Map(nodes.map((node) => [guid(node.guid), node]));
  const childrenByParent = new Map();
  for (const node of nodes) {
    if (!node.parentIndex?.guid) {
      continue;
    }
    const parent = guid(node.parentIndex.guid);
    childrenByParent.set(parent, [
      ...(childrenByParent.get(parent) ?? []),
      node,
    ]);
  }
  return { nodes, nodesById, childrenByParent };
}

function approvedNodeIds(frameIds, nodesById, childrenByParent) {
  const selected = new Set();
  const visit = (nodeId) => {
    if (selected.has(nodeId)) {
      return;
    }
    const node = nodesById.get(nodeId);
    if (!node) {
      throw new Error(`Missing approved frame ${nodeId}`);
    }
    selected.add(nodeId);
    for (const child of childrenByParent.get(nodeId) ?? []) {
      visit(guid(child.guid));
    }
  };
  for (const frameId of frameIds) {
    visit(frameId);
  }
  return selected;
}

function nodeAtSymbolPath(nodesById, symbolRootId, pathIds) {
  const last = pathIds.at(-1) ?? symbolRootId;
  return nodesById.get(last) ?? nodesById.get(symbolRootId);
}

function effectiveOwnerId(nodeId, pathIds) {
  return pathIds.length ? `${nodeId}/${pathIds.join('/')}` : nodeId;
}

function overridePathIds(override, symbolId) {
  const pathIds = (override.guidPath?.guids ?? []).map(guid);
  return pathIds.length === 1 && pathIds[0] === symbolId ? [] : pathIds;
}

function targetNodeId(action) {
  const target = action?.transitionNodeID;
  if (!target) {
    return null;
  }
  if (target.sessionID === 4294967295 && target.localID === 4294967295) {
    return null;
  }
  return guid(target);
}

function eventType(interaction) {
  return interaction.event?.interactionType;
}

function toMotion(nodeId, interaction, action = interaction.actions?.[0] ?? {}) {
  return {
    nodeId,
    interactionId: interactionKey(interaction),
    event: eventType(interaction),
    navigation: action.navigationType ?? null,
    targetNodeId: targetNodeId(action),
    transition: action.transitionType ?? null,
    durationMs: (action.transitionDuration ?? 0) * 1000,
    prototypeDelayMs: (interaction.event?.transitionTimeout ?? 0) * 1000,
    easingType: action.easingType ?? null,
    easingFunction: action.easingFunction ?? [],
  };
}

function collectMotions({ frameIds, nodes, nodesById, childrenByParent }) {
  const approved = approvedNodeIds(frameIds, nodesById, childrenByParent);
  const motions = [];

  for (const node of nodes) {
    const nodeId = guid(node.guid);
    if (!approved.has(nodeId)) {
      continue;
    }

    const own = node.prototypeInteractions ?? [];
    if (node.symbolData?.symbolID) {
      const symbolId = guid(node.symbolData.symbolID);
      const symbol = nodesById.get(symbolId);
      const overrideGroups = [];
      for (const override of node.symbolData.symbolOverrides ?? []) {
        overrideGroups.push({
          interactions: override.prototypeInteractions ?? [],
          pathIds: overridePathIds(override, symbolId),
        });
      }
      const rootInteractions = mergeInteractions(
        symbol?.prototypeInteractions ?? [],
        own,
        overrideGroups
          .filter((override) => override.pathIds.length === 0)
          .flatMap((override) => override.interactions),
      );
      for (const interaction of rootInteractions) {
        for (const action of interaction.actions ?? []) motions.push(toMotion(nodeId, interaction, action));
      }

      for (const { interactions: overrideInteractions, pathIds } of overrideGroups) {
        if (pathIds.length === 0) {
          continue;
        }
        const symbolNode = nodeAtSymbolPath(nodesById, symbolId, pathIds);
        const interactions = mergeInteractions(
          symbolNode?.prototypeInteractions ?? [],
          [],
          overrideInteractions,
        );
        for (const interaction of interactions) {
          for (const action of interaction.actions ?? []) motions.push(toMotion(effectiveOwnerId(nodeId, pathIds), interaction, action));
        }
      }
      continue;
    }

    for (const interaction of own) {
      for (const action of interaction.actions ?? []) motions.push(toMotion(nodeId, interaction, action));
    }
  }

  // Preserve all effective approved records, then add only component-state
  // dependencies. Old prototype page targets are not new product pages.
  const dependencies = new Set();
  const initialSymbols = new Set();
  for (const id of approved) {
    const symbol = nodesById.get(id)?.symbolData?.symbolID;
    if (symbol) { dependencies.add(guid(symbol)); initialSymbols.add(guid(symbol)); }
  }
  for (const motion of motions) {
    if (motion.navigation === 'SWAP_STATE' && motion.targetNodeId) dependencies.add(motion.targetNodeId);
  }
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id) || approved.has(id)) return;
    visited.add(id);
    const node = nodesById.get(id);
    if (!node) return;
    for (const interaction of mergeInteractions([], node.prototypeInteractions ?? [], [])) {
      for (const action of interaction.actions ?? []) {
        const motion = toMotion(id, interaction, action);
        if (motion.navigation === 'SWAP_STATE') motions.push(motion);
        if (motion.navigation === 'SWAP_STATE' && motion.targetNodeId) dependencies.add(motion.targetNodeId);
      }
    }
    // Instance child overrides remain authoritative; raw child actions must not
    // resurrect interactions deleted on the approved instance.
    if (!initialSymbols.has(id)) for (const child of childrenByParent.get(id) ?? []) visit(guid(child.guid));
  };
  for (const id of dependencies) visit(id);
  return motions.filter(
    (motion) =>
      motion.event &&
      ['NAVIGATE', 'SWAP_STATE', 'SCROLL_TO'].includes(motion.navigation),
  );
}

function moduleText(frameIds, motions) {
  return `export type SourceMotion = {
  nodeId: string;
  interactionId: string;
  event: 'ON_HOVER' | 'ON_PRESS' | 'ON_CLICK' | 'AFTER_TIMEOUT' | 'DRAG';
  navigation: 'NAVIGATE' | 'SWAP_STATE' | 'SCROLL_TO';
  targetNodeId: string | null;
  transition: string | null;
  durationMs: number;
  prototypeDelayMs: number;
  easingType: string | null;
  easingFunction: readonly number[];
};

export const sourceMotionFrameIds = ${JSON.stringify(frameIds, null, 2)} as const;

export const sourceMotions = ${JSON.stringify(motions, null, 2)} as const satisfies readonly SourceMotion[];

export function getSourceMotion(
  nodeId: string,
  event: SourceMotion['event'],
  targetNodeId?: string,
): SourceMotion | null {
  return sourceMotions.find(
    (motion) =>
      motion.nodeId === nodeId &&
      motion.event === event &&
      (targetNodeId === undefined || motion.targetNodeId === targetNodeId),
  ) ?? null;
}
`;
}

/**
 * @param {{
 *   designSource?: string;
 *   frameIds?: string[];
 *   outputPath?: string;
 * }} [options]
 */
export async function extractSourceMotion({
  designSource = process.env.INTELLIDEPLOY_FIGMA_SOURCE,
  frameIds = undefined,
  outputPath = defaultOutputPath,
} = /** @type {{designSource?: string; frameIds?: string[]; outputPath?: string}} */ ({})) {
  if (!designSource) {
    throw new Error('INTELLIDEPLOY_FIGMA_SOURCE is required');
  }
  const sourceFrameIds = frameIds ?? (await defaultFrameIds());
  const document = await loadDocument(designSource);
  const motions = collectMotions({
    frameIds: sourceFrameIds,
    ...document,
  });
  const text = moduleText(sourceFrameIds, motions);
  const suffix = `${process.pid}-${randomUUID()}`;
  const temporaryOutput = `${outputPath}.tmp-${suffix}`;

  await mkdir(path.dirname(outputPath), { recursive: true });
  try {
    await writeFile(temporaryOutput, text);
    await rename(temporaryOutput, outputPath);
  } catch (error) {
    await rm(temporaryOutput, { force: true });
    throw error;
  }

  return {
    frameCount: sourceFrameIds.length,
    motionCount: motions.length,
  };
}

const isEntryPoint =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isEntryPoint) {
  const result = await extractSourceMotion();
  console.log(
    `Extracted ${result.motionCount} source motions from ${result.frameCount} approved frames.`,
  );
}
