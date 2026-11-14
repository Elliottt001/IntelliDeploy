import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSourceEffect } from './extract-mobile-component-evidence.mjs';
const identity = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 };
export async function extractControlMotionEvidence({ source = process.env.INTELLIDEPLOY_FIGMA_SOURCE, output = fileURLToPath(new URL('../design/sourceControlMotionEvidence.ts', import.meta.url)) } = {}) {
  if (!source) throw Error('INTELLIDEPLOY_FIGMA_SOURCE required');
  const doc = JSON.parse(await readFile(path.join(source, 'design-data/document.kiwi.json'), 'utf8'));
  const id = g => `${g.sessionID}:${g.localID}`;
  const nodes = new Map(doc.nodeChanges.map(n => [id(n.guid), n]));
  const children = new Map();
  for (const n of doc.nodeChanges) if (n.parentIndex?.guid) {
    const parent = id(n.parentIndex.guid);
    children.set(parent, [...(children.get(parent) ?? []), n]);
  }
  const decode = index => {
    const bytes = Buffer.from(doc.blobs[index].bytes.data, 'base64');
    let offset = 0; const commands = [];
    while (offset < bytes.length) {
      const op = bytes[offset++], letter = ['Z', 'M', 'L', 'Q', 'C'][op];
      if (!letter) throw Error('Invalid Kiwi path opcode');
      commands.push(letter + Array.from({length: [0, 2, 2, 4, 6][op]}, () => {
        const value = bytes.readFloatLE(offset); offset += 4; return value;
      }).join(' '));
    }
    return commands.join(' ').replace(/^(?:Z\s*)+/, '');
  };
  const color = c => c ? `#${[c.r??c.c0,c.g??c.c1,c.b??c.c2].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}` : undefined;
  const normalizedPaint = p => ({type:p.type, color:color(p.color), opacity:p.opacity??1, variableIds:[],
    gradientStops:p.stops?.map(stop=>({color:color(stop.color??stop.authoredColor),opacity:stop.color?.a??stop.authoredColor?.c3??1,position:stop.position,variableIds:[]})),
    start:p.transform?{x:p.transform.m02,y:p.transform.m12}:undefined,
    end:p.transform?{x:p.transform.m00+p.transform.m02,y:p.transform.m10+p.transform.m12}:undefined,
    transform:p.transform?`matrix(${p.transform.m00} ${p.transform.m10} ${p.transform.m01} ${p.transform.m11} ${p.transform.m02} ${p.transform.m12})`:undefined,
  });
  const tree = (nodeId, matchKey = '') => {
    const n = nodes.get(nodeId);
    if (!n) throw Error(`Missing source control ${nodeId}`);
    const geometry = [];
    for (const [geometries, paints] of [[n.fillGeometry, n.fillPaints], [n.strokeGeometry, n.strokePaints]]) {
      for (const paint of paints ?? []) {
        if (paint.visible === false) continue;
        if (!['SOLID','GRADIENT_LINEAR','GRADIENT_RADIAL'].includes(paint.type)) throw Error(`Unsupported control paint ${paint.type}: ${nodeId}`);
        const c = paint.color;
        for (const g of geometries ?? []) geometry.push({
          sourceNodeId: nodeId, path: decode(g.commandsBlob), fillRule: g.windingRule === 'ODD' ? 'evenodd' : 'nonzero',
          fill: color(c), paint: normalizedPaint(paint),
          opacity: (paint.opacity ?? 1) * (c?.a ?? 1),
          rawPaint: paint,
        });
      }
    }
    // Text is the original outlined glyph geometry, not a system-font guess.
    if (n.type === 'TEXT') for (const glyph of n.derivedTextData?.glyphs ?? []) {
      const styleId=n.textData?.characterStyleIDs?.[glyph.firstCharacter]??0;
      const style=n.textData?.styleOverrideTable?.find(s=>s.styleID===styleId);
      const paint=(style?.fillPaints??n.fillPaints??[]).find(p=>p.visible!==false);
      if (!paint) continue;
      geometry.push({sourceNodeId:nodeId,path:decode(glyph.commandsBlob),fillRule:'nonzero',fill:color(paint.color),opacity:(paint.opacity??1)*(paint.color?.a??1),rawPaint:paint,
        transform:`matrix(${glyph.fontSize} 0 0 ${-glyph.fontSize} ${glyph.position.x} ${glyph.position.y})`});
    }
    const siblings = (children.get(nodeId) ?? []).sort((a,b) => a.parentIndex.position < b.parentIndex.position ? -1 : 1);
    const occurrence = new Map();
    return {
      sourceNodeId: nodeId, matchKey, name: n.name, type: n.type,
      size: n.size, transform: n.transform ?? identity, opacity: n.opacity ?? 1, visible: n.visible !== false,
      clipsContent: n.frameMaskDisabled === false, mask: !!(n.mask ?? n.isMask), booleanOperation: n.type === 'BOOLEAN_OPERATION',
      cornerRadius: n.cornerRadius, blendMode: n.blendMode, maskPaths: geometry.map(g => ({path:g.path,fillRule:g.fillRule})),
      geometry, effects: (n.effects ?? []).map(e => normalizeSourceEffect(e,nodeId)).filter(Boolean),
      children: siblings.map(c => {
        const key = `${c.name}:${c.type}`, index = occurrence.get(key) ?? 0;
        occurrence.set(key,index+1);
        return tree(id(c.guid), `${matchKey}/${key}:${index}`);
      }),
    };
  };
  const states = Object.fromEntries(['248:20538','248:20537','228:19794','228:19793','228:19791','228:19792','270:26291','188:16338','270:26318','188:16981','825:6080','825:6100','825:6133','825:6153','825:6434','825:6491','825:6532','825:6588','825:6606','825:6640'].map(k => [k,tree(k)]));
  const pageRoots=['270:26263','188:16287','188:16759','266:21147','268:22904','268:23238','268:23572','268:23906','845:3479','168:6358','825:6452'];
  const routeNodes={};
  for(const pageRoot of pageRoots){const counts=new Map();for(const n of (children.get(pageRoot)??[]).sort((a,b)=>a.parentIndex.position<b.parentIndex.position?-1:1)){
    const semantic=`${n.name}:${n.type}`,occurrence=counts.get(semantic)??0;counts.set(semantic,occurrence+1);
    routeNodes[id(n.guid)]={key:`${semantic}:${occurrence}`,pageRoot,size:n.size,transform:n.transform,opacity:n.opacity??1,visible:n.visible!==false};
  }}
  for(const state of Object.values(states)) if(state.name==='头像'&&!routeNodes[state.sourceNodeId])routeNodes[state.sourceNodeId]={key:'头像:FRAME:0',pageRoot:'168:6358',size:state.size,transform:state.transform,opacity:state.opacity,visible:state.visible};
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}`;
  await writeFile(temporary, `// Original Symbol states; root transform is component-set placement, retained as evidence.\nimport type { SourceControlState } from '../components/mobile/sourceControlInterpolation';\nexport const sourceControlStates: Record<string, SourceControlState> = ${JSON.stringify(states)};\nexport const sourceRouteNodes = ${JSON.stringify(routeNodes)} as const;\n`);
  await rename(temporary,output);
  return Object.keys(states).length;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Extracted ${await extractControlMotionEvidence()} control states`);
