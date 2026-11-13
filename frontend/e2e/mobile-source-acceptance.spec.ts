import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { mobileEvidence, mobileApprovedFrameIds } from '../design/mobileEvidence';
import { sourceAspects, summarizeSourceAcceptance } from '../scripts/summarize-mobile-source-acceptance.mjs';
import { sourceBox, sourceNode } from '../tests/figmaSource';
import { installMobileSourceFixtures } from './sourceAssertions';
import { makeVisualApp, visualJobStates, visualPrompt, visualRankingPublications } from './mobileVisualFixtures';

type CheckStatus = 'PASS' | 'FAIL' | 'NOT_RUN' | 'NOT_IMPLEMENTED' | 'API_UNAVAILABLE' | 'BACKEND_BLOCKED';
type SourceAcceptanceRecord = {
  frameId: string; sourceSha256: string;
  dataEvidence: 'existing-api' | 'readonly-api-snapshot' | 'fixture' | 'unavailable';
  checks: Record<typeof sourceAspects[number], CheckStatus>;
  evidence: string[];
};
const output = 'artifacts/source-acceptance';
const guid = (g: { sessionID: number; localID: number }) => `${g.sessionID}:${g.localID}`;
const viewports = [320, 360, 375, 390, 430].map(width => ({ width, height: 812 }))
  .concat([{ width: 320, height: 568 }, { width: 430, height: 932 }]);

// Read source commands directly. The encoder uses one opcode followed by LE
// floats; this test does not consult generated geometry or screenshot baselines.
function sourcePath(blob: { bytes: { data: string } }) {
  const bytes = Buffer.from(blob.bytes.data, 'base64'), result: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    const code = bytes[offset++], name = ['Z', 'M', 'L', 'Q', 'C'][code];
    if (!name) throw Error('Invalid source path opcode');
    const count = [0, 2, 2, 4, 6][code], coordinates: number[] = [];
    for (let i = 0; i < count; i++, offset += 4) coordinates.push(Number(bytes.readFloatLE(offset).toFixed(6)));
    result.push(name + coordinates.join(' '));
  }
  return result.join(' ').replace(/^(?:Z\s*)+/, '');
}

function equivalentPath(actual: string, expected: string) {
  const tokens = (path: string) => path.match(/[MLQCZ]|-?(?:\d*\.?\d+)(?:e[+-]?\d+)?/gi) ?? [];
  const a = tokens(actual), b = tokens(expected);
  // The existing renderer rounds sub-micro-unit float noise to zero. Compare
  // each command and coordinate at its six-decimal encoding precision.
  return a.length === b.length && a.every((token, i) => token === b[i]
    || (Number.isFinite(Number(token)) && Number.isFinite(Number(b[i])) && Math.abs(Number(token) - Number(b[i])) <= 0.000001));
}

function pathKey(path: string) {
  return (path.match(/[MLQCZ]|-?(?:\d*\.?\d+)(?:e[+-]?\d+)?/gi) ?? []).map(token => {
    const number = Number(token);
    return Number.isFinite(number) ? Math.abs(number) <= 0.000001 ? '0' : String(Number(number.toFixed(6))) : token.toUpperCase();
  }).join(' ');
}

async function sample(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const box = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const elements = Array.from(document.querySelectorAll('[data-testid], [data-source-node], [data-source-group], svg[aria-label]')).map(element => {
      const css = getComputedStyle(element);
      const svg = element instanceof SVGGraphicsElement ? element : null;
      const matrix = svg?.getScreenCTM();
      return {
        tag: element.tagName, testId: element.getAttribute('data-testid'), label: element.getAttribute('aria-label'),
        sourceId: element.getAttribute('data-source-node') ?? element.getAttribute('data-source-group'),
        box: box(element), transform: css.transform, localTransform: element.getAttribute('transform'),
        screenMatrix: matrix ? [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f] : null,
        display: css.display, visibility: css.visibility, opacity: css.opacity,
        fontFamily: css.fontFamily, fontSize: css.fontSize, fontWeight: css.fontWeight,
        lineHeight: css.lineHeight, letterSpacing: css.letterSpacing, color: css.color,
        background: css.backgroundColor, backgroundImage: css.backgroundImage,
        borderRadius: css.borderRadius, shadow: css.boxShadow, filter: css.filter,
        backdropFilter: css.backdropFilter, clipPath: css.clipPath, blend: css.mixBlendMode,
        fill: element.getAttribute('fill'), stroke: element.getAttribute('stroke'),
        strokeWidth: element.getAttribute('stroke-width'), path: element.getAttribute('d'),
        text: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : element.textContent,
        expanded: element.getAttribute('aria-expanded'), scrollTop: element.scrollTop,
        glyphs: element.tagName === 'svg' && element.hasAttribute('aria-label') ? Array.from(element.querySelectorAll('path')).map(p => ({ path: p.getAttribute('d'), transform: p.getAttribute('transform'), fill: p.getAttribute('fill'), opacity: p.getAttribute('opacity') })) : [],
      };
    });
    const nativeText = Array.from(document.querySelectorAll('input,textarea,div,span')).filter(element =>
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      || Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()),
    ).map(element => {
      const css = getComputedStyle(element);
      return { text: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : element.textContent,
        box: box(element), font: css.font, fontFamily: css.fontFamily, fontSize: css.fontSize,
        lineHeight: css.lineHeight, letterSpacing: css.letterSpacing, color: css.color,
        fontLoaded: document.fonts.check(`${css.fontSize} ${css.fontFamily}`) };
    });
    const painted = Array.from(document.querySelectorAll('svg path,svg stop,svg filter,svg mask,svg clipPath,svg linearGradient,svg radialGradient')).map(element => ({
      tag: element.tagName, attributes: Object.fromEntries(Array.from(element.attributes).map(a => [a.name, a.value])),
      box: box(element), children: ['filter', 'mask', 'clipPath'].includes(element.tagName) ? element.innerHTML : undefined,
    }));
    const fontFaces: Array<{family: string; status: string; weight: string; style: string}> = [];
    document.fonts.forEach(face => fontFaces.push({ family: face.family, status: face.status, weight: face.weight, style: face.style }));
    return { sampledAt: performance.now(), url: location.pathname, viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      fontFaces,
      images: Array.from(document.images).map(img => ({ url: img.currentSrc || img.src, complete: img.complete,
        naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, box: box(img), objectFit: getComputedStyle(img).objectFit })),
      activeInput: document.activeElement?.getAttribute('data-testid'), elements, nativeText, painted };
  });
}

async function enterState(page: Page, family: string, number: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (family === 'login') { await page.evaluate(() => localStorage.removeItem('token')); await page.goto('/login'); }
  else if (family === 'home') {
    await page.goto('/');
    await expect(page.getByTestId('home-mibo-open')).toBeVisible();
    if (number === 29 || number === 31) {
      await page.getByTestId('home-inspiration-refresh').click();
      if (number === 31) await page.getByTestId('home-inspiration-refresh').click();
      await expect(page.getByTestId('home-suggestions')).toHaveAttribute('id', number === 29 ? '188:16981' : '270:26318');
    }
    if (number === 30) {
      const b = (await page.getByTestId('home-mibo-avatar').boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
      await expect(page.getByTestId('home-avatar-pressed')).toBeVisible();
    }
    const key = ({ 32: 'store', 33: 'products', 34: 'community', 35: 'profile' } as Record<number, string>)[number];
    if (key) { await page.getByTestId(`home-card-${key}`).click(); await expect(page.getByTestId(`home-card-${key}-open`)).toBeVisible(); }
  } else if (family === 'store') {
    if (number === 40) await page.route('**/api/community/apps**', r => r.fulfill({ json: { items: visualRankingPublications, next_cursor: null } }));
    await page.goto(number === 3 ? '/store' : '/store/ranking');
    await expect(page.getByText('笔记工具').first()).toBeVisible();
  } else if (family === 'chatbot') {
    const state = visualJobStates.find(([n]) => n === number);
    if (state) {
      const app = makeVisualApp(state[0], state[1], state[2]);
      await page.route('**/api/apps/app', r => r.fulfill({ json: app }));
      await page.route('**/api/jobs/job', r => r.fulfill({ json: app.latest_job }));
      await page.goto('/app-detail/app'); await expect(page.getByTestId('job-status')).toBeVisible();
      await page.getByTestId('message-input').fill(visualPrompt); await page.getByTestId('message-input').blur();
      if (app.conversation.length > 1) expect((await page.getByTestId('latest-assistant-reply').textContent())!.replace(/\s/g, '')).toBe(app.conversation.at(-1)!.content.replace(/\s/g, ''));
    } else {
      await page.goto('/chatbot'); await expect(page.getByTestId('create-prompt')).toBeVisible();
      if (number === 47) { await page.getByTestId('create-prompt').fill(visualPrompt); await page.getByTestId('create-prompt').blur(); }
    }
  } else if (family === 'products') {
    await page.goto('/app-gallery'); await expect(page.getByTestId('product-folder-created')).toBeVisible();
    if (number === 57) { await page.getByTestId('product-folder-created').click(); await expect(page.getByTestId('product-folder-created')).toHaveAttribute('aria-expanded', 'true'); }
  } else {
    await page.goto('/community'); const rail = page.getByTestId('community-source-rail'); await expect(rail).toBeVisible();
    if (number === 60) { await rail.hover(); await page.mouse.wheel(94, 0); await expect.poll(() => rail.getAttribute('data-source-progress')).toBe('1'); }
  }
}

test('collects actual 26 source states without upgrading partial or fixture evidence', async ({ browser }, info) => {
  test.setTimeout(300_000);
  const sourceRoot = process.env.INTELLIDEPLOY_FIGMA_SOURCE;
  expect(sourceRoot, 'Source acceptance requires the original Kiwi, never generated constants').toBeTruthy();
  const bytes = await readFile(join(sourceRoot!, 'design-data/document.kiwi.json'));
  const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
  const producer = {
    collectorSha256: createHash('sha256').update(await readFile('e2e/mobile-source-acceptance.spec.ts')).digest('hex'),
    productMotionSha256: createHash('sha256').update(await readFile('components/mobile/useSourceMotion.ts')).digest('hex'),
  };
  const document = JSON.parse(bytes.toString());
  const nodes = new Map<string, Record<string, any>>(document.nodeChanges.map((n: Record<string, any>) => [guid(n.guid), n]));
  const children = new Map<string, string[]>();
  for (const [id, node] of nodes) if (node.parentIndex?.guid) {
    const parent = guid(node.parentIndex.guid); children.set(parent, [...(children.get(parent) ?? []), id]);
  }
  const records: Array<SourceAcceptanceRecord & Record<string, unknown>> = [];
  const failures: string[] = [];
  await mkdir(output, { recursive: true });
  // A fresh collection never silently reuses a previous complete summary.
  await writeFile(`${output}/records.json`, JSON.stringify({ overall: 'NOT_RUN', records: [], sourceSha256, producer }));
  for (const [family, manifest] of Object.entries(mobileEvidence)) for (const [index, frameId] of manifest.frameIds.entries()) {
    const number = Number(manifest.pages[index].split('-')[1]);
    const subtree = new Set<string>([frameId]);
    for (const id of subtree) for (const child of children.get(id) ?? []) subtree.add(child);
    const rawNodes = [...subtree].map(id => nodes.get(id)!);
    const context = await browser.newContext({ baseURL: String(info.project.use.baseURL), viewport: { width: 375, height: 812 } });
    const page = await context.newPage(), responses: unknown[] = [], pendingResponses: Promise<void>[] = [], snapshots: Awaited<ReturnType<typeof sample>>[] = [];
    page.setDefaultTimeout(10_000); page.setDefaultNavigationTimeout(15_000);
    const checks = Object.fromEntries(sourceAspects.map(a => [a, 'NOT_RUN'])) as SourceAcceptanceRecord['checks'];
    const rawEffects = rawNodes.flatMap(n => (n.effects ?? []).map((effect: unknown) => ({ nodeId: guid(n.guid), effect })));
    const unsupported = rawEffects.filter(({ effect }: any) => ['GLASS', 'NOISE', 'GRAIN', 'LAYER_BLUR'].includes(effect.type));
    if (unsupported.length) checks.PAINT_EFFECT = 'NOT_IMPLEMENTED';
    // Shared BottomNav/source route transitions remain unimplemented. Local
    // transitions below cannot certify the full source motion inventory.
    checks.MOTION_INTERACTION = family === 'login' ? 'NOT_RUN' : 'NOT_IMPLEMENTED';
    checks.DATA_BINDING = family === 'community' || (family === 'home' && number === 34) ? 'API_UNAVAILABLE' : 'NOT_RUN';
    const record: SourceAcceptanceRecord & Record<string, unknown> = {
      frameId, sourceSha256, dataEvidence: checks.DATA_BINDING === 'API_UNAVAILABLE' ? 'unavailable' : 'fixture', checks,
      evidence: [`${output}/frame-${frameId.replace(':', '-')}.json`, 'Original Kiwi nodes/paths and actual browser measurements; fixture API does not certify real data',
        'Full structure/text/geometry inventories are not completely compared: NOT_RUN; native safe-area/keyboard/device/font scaling NOT_RUN',
        'GLASS/NOISE are not implemented; supported filter samples do not certify an entire effect stack',
        'Shared BottomNav/source route motion NOT_IMPLEMENTED; local actions do not certify every inherited/overridden interaction'],
      family, page: number, producer,
    };
    let activeAspect = 'STRUCTURE';
    try {
      page.on('response', response => {
        if (/\/api\/|\/auth\//.test(response.url())) pendingResponses.push((async () => { responses.push({ path: new URL(response.url()).pathname, status: response.status(), body: await response.json().catch(() => null), origin: 'fixture' }); })());
      });
      await installMobileSourceFixtures(page);
      await page.goto('/login'); // Establish origin before clearing login token.
      await enterState(page, family, number);
      for (const viewport of viewports) {
        await page.setViewportSize(viewport); await page.waitForTimeout(80);
        const actual = await sample(page); snapshots.push(actual);
        activeAspect = 'RESPONSIVE_GEOMETRY';
        expect(actual.documentWidth, `${frameId} overflow at ${viewport.width}/${viewport.height}`).toBeLessThanOrEqual(viewport.width);
        activeAspect = 'STRUCTURE';
        expect(actual.painted.some(p => p.tag === 'path' && p.box.width > 0 && p.box.height > 0), `${frameId} real vector geometry`).toBe(true);
        activeAspect = 'TEXT_STYLE';
        expect(actual.nativeText.some(t => t.fontLoaded && t.box.height > 0), `${frameId} live native font resolution`).toBe(true);
      }
      const reference = snapshots.find(s => s.viewport.width === 375)!;
      // Some existing SVG renderers do not emit source-node attributes. Bind
      // their actual painted commands to the original frame inventory instead
      // of requiring a tag. Ambiguous candidates and unmatched paths stay visible.
      const sourcePaths = new Map<string, Array<{nodeId: string; kind: string; path: string; nodeBox: ReturnType<typeof sourceBox>}>>();
      for (const raw of rawNodes) for (const [kind, geometries] of Object.entries({ fill: raw.fillGeometry ?? [], stroke: raw.strokeGeometry ?? [], glyph: raw.derivedTextData?.glyphs ?? [] })) {
        for (const g of geometries as Array<{commandsBlob: number}>) {
          const path = sourcePath(document.blobs[g.commandsBlob]), key = pathKey(path), nodeId = guid(raw.guid);
          if (key) sourcePaths.set(key, [...(sourcePaths.get(key) ?? []), { nodeId, kind, path, nodeBox: sourceBox(frameId, nodeId) }]);
        }
      }
      const runtimeSourcePathMatches = reference.painted.filter(p => p.tag === 'path' && p.attributes.d).map(p => ({
        actual: p, candidates: sourcePaths.get(pathKey(p.attributes.d)) ?? [],
        placementCheck: 'NOT_RUN', fullPaintStackCheck: 'NOT_RUN',
      }));
      // Compare actual runtime paths against original raw commands. Missing
      // IDs/unsupported paints are retained as gaps, not treated as PASS.
      const comparisons = reference.elements.filter(e => e.sourceId && nodes.has(e.sourceId) && e.path).map(e => {
        const raw = nodes.get(e.sourceId!)!, geometries = [...(raw.fillGeometry ?? []), ...(raw.strokeGeometry ?? [])];
        const expectedPaths = geometries.map((g: { commandsBlob: number }) => sourcePath(document.blobs[g.commandsBlob]));
        const expectedColors = [...(raw.fillPaints ?? []), ...(raw.strokePaints ?? [])].filter(p => p.type === 'SOLID').map(p => {
          const color = p.color ?? p.authoredColor;
          return '#' + [color.r ?? color.c0, color.g ?? color.c1, color.b ?? color.c2].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
        });
        const colorComparable = !!e.fill?.match(/^#[0-9a-f]{6}$/i) && expectedColors.length > 0;
        return { sourceId: e.sourceId, actual: e.path, expected: expectedPaths, coordinateTolerance: 0.000001, pathMatch: expectedPaths.some((p: string) => equivalentPath(e.path!, p)),
          actualFill: e.fill, expectedColors, colorComparable, colorMatch: colorComparable ? expectedColors.includes(e.fill!.toUpperCase()) : null, inFrame: subtree.has(e.sourceId!) };
      });
      activeAspect = 'STRUCTURE';
      for (const comparison of comparisons) if (comparison.expected.length) expect(comparison.pathMatch, `${frameId} actual path ${comparison.sourceId}`).toBe(true);
      activeAspect = 'PAINT_EFFECT';
      for (const comparison of comparisons) if (comparison.colorComparable) expect(comparison.colorMatch, `${frameId} actual SOLID fill ${comparison.sourceId}`).toBe(true);
      activeAspect = 'TEXT_STYLE';
      const sourceTextComparisons = rawNodes.filter(n => n.textData?.characters).map(n => {
        const ancestors: string[] = []; let parent = n.parentIndex?.guid;
        while (parent && nodes.has(guid(parent))) {
          const ancestor = nodes.get(guid(parent))!; ancestors.push(ancestor.name); parent = ancestor.parentIndex?.guid;
        }
        const sourceNavLabel = ancestors.includes('底部文字框');
        // The same Chinese label is used for a 16pt home title and a 7pt nav
        // label. Bind their structural roles before comparing glyph metrics.
        const actualGlyphs = reference.elements.filter(e => e.label === n.textData.characters && e.glyphs.length
          && Boolean(e.testId?.startsWith('bottom-nav-label-')) === sourceNavLabel);
        const expectedGlyphs = (n.derivedTextData?.glyphs ?? []).map((g: { commandsBlob: number; position: {x: number; y: number}; fontSize: number }) => ({ path: sourcePath(document.blobs[g.commandsBlob]), position: g.position, fontSize: g.fontSize }));
        for (const svg of actualGlyphs) {
          expect(svg.glyphs.length, `${frameId} ${guid(n.guid)} static glyph count`).toBe(expectedGlyphs.length);
          for (const [i, glyph] of svg.glyphs.entries()) {
            expect(equivalentPath(glyph.path!, expectedGlyphs[i].path), `${frameId} ${guid(n.guid)} actual glyph ${i}`).toBe(true);
            const matrix = glyph.transform!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number);
            expect(matrix[0], `${frameId} ${guid(n.guid)} glyph${i}.x`).toBeCloseTo(expectedGlyphs[i].position.x, 5); expect(matrix[1], `${frameId} ${guid(n.guid)} glyph${i}.y`).toBeCloseTo(expectedGlyphs[i].position.y, 5);
            expect(matrix[2], `${frameId} ${guid(n.guid)} glyph${i}.size`).toBeCloseTo(expectedGlyphs[i].fontSize, 5); expect(matrix[3], `${frameId} ${guid(n.guid)} glyph${i}.verticalSize`).toBeCloseTo(-expectedGlyphs[i].fontSize, 5);
          }
        }
        return { sourceId: guid(n.guid), expected: { characters: n.textData.characters, fontName: n.fontName, fontSize: n.fontSize, lineHeight: n.lineHeight, letterSpacing: n.letterSpacing, baselines: n.derivedTextData?.baselines, glyphs: expectedGlyphs },
          actual: reference.nativeText.filter(t => t.text === n.textData.characters), actualGlyphs,
        };
      });
      // Direct password coverage strengthens the deferred Task5 minor.
      if (family === 'login') {
        const raw = sourceNode('119:76688'), text = sourceNode('119:76689');
        const expected = sourceBox(frameId, '119:76688');
        const actual = await page.getByTestId('login-password').evaluate(element => {
          const r = element.getBoundingClientRect(), c = getComputedStyle(element);
          return { x: r.x, y: r.y, width: r.width, height: r.height, font: c.fontFamily, fontSize: parseFloat(c.fontSize) };
        });
        // Return to the actual 375 reference before comparing source geometry.
        await page.setViewportSize({ width: 375, height: 812 }); await page.waitForTimeout(80);
        const ref = (await sample(page)).elements.find(e => e.testId === 'login-password')!;
        activeAspect = 'RESPONSIVE_GEOMETRY';
        expect(ref.box.x).toBeCloseTo(expected.x, 1); expect(ref.box.y).toBeCloseTo(expected.y, 1);
        expect(ref.box.width).toBeCloseTo(raw.size.x, 1); expect(ref.box.height).toBeCloseTo(raw.size.y, 1);
        activeAspect = 'TEXT_STYLE';
        expect(parseFloat(ref.fontSize)).toBeCloseTo(text.fontSize, 3); expect(ref.fontFamily).toContain('AlibabaPuHuiTiLight');
        record.passwordSourceComparison = { expected: { box: expected, fontName: text.fontName, fontSize: text.fontSize }, actualAt430: actual, actualAt375: ref };
        await page.getByTestId('login-password').fill('task11-local-password'); await page.getByTestId('login-password').focus();
        record.browserInputFocus = await sample(page); await page.getByTestId('login-password').blur();
      }
      // Record actual actions and their changing pixels/geometry without image
      // capture. Full source easing/cancel inventory remains separately scoped.
      await page.setViewportSize({ width: 375, height: 812 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
      activeAspect = 'MOTION_INTERACTION';
      const before = await sample(page);
      if (family === 'products') await page.getByTestId('product-folder-created').click();
      else if (family === 'home' && number === 30) { await page.mouse.up(); await expect(page.getByTestId('create-prompt')).toBeVisible(); }
      else if (family === 'home') await page.getByTestId(number >= 32 ? `home-card-${({32:'store',33:'products',34:'community',35:'profile'} as Record<number,string>)[number]}` : 'home-inspiration-refresh').click();
      else if (family === 'community') { await page.getByTestId('community-source-rail').hover(); await page.mouse.wheel(number === 60 ? -94 : 94, 0); }
      else if (family === 'chatbot') { const input = page.getByTestId(number < 48 ? 'create-prompt' : 'message-input'); await input.focus(); await input.fill(`${visualPrompt}\nTask11 live input`); }
      else if (family === 'store') await page.mouse.wheel(0, 180);
      else { await page.getByTestId('login-account').fill('task11-local-account'); await page.getByTestId('login-account').focus(); }
      await page.waitForTimeout(100); const middle = await sample(page);
      await page.waitForTimeout(1400); const after = await sample(page);
      await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(50); const reduced = await sample(page);
      await Promise.all(pendingResponses);
      record.runtime = { viewports: snapshots, comparisons, runtimeSourcePathMatches, sourceTextComparisons, motion: { before, middle, after, reduced }, responses };
      record.partialChecks = { horizontalOverflow: 'PASS', rawPathCommands: comparisons.filter(c => c.expected.length).length ? 'PASS' : 'NOT_RUN',
        browserFontCheck: 'PASS', comparedPathCount: comparisons.filter(c => c.expected.length).length,
        comparedSolidPaintCount: comparisons.filter(c => c.colorComparable).length,
        comparedStaticTextNodeCount: sourceTextComparisons.filter(c => c.actualGlyphs.length).length,
        runtimeSourcePathMatchCount: runtimeSourcePathMatches.filter(p => p.candidates.length).length,
        runtimeSourcePathUnmatchedCount: runtimeSourcePathMatches.filter(p => !p.candidates.length).length,
        sourceTextComplete: 'NOT_RUN', nativeKeyboardAndLargeFont: 'NOT_RUN', everyLocalSourceMotion: 'NOT_RUN' };
    } catch (error) {
      const message = String(error); failures.push(`${frameId}: ${message}`); record.error = message;
      record.checks[activeAspect] = 'FAIL'; record.failedAspect = activeAspect; record.runtime = { viewports: snapshots, responses };
    } finally {
      record.source = { nodes: rawNodes, effects: rawEffects, unsupportedEffects: unsupported,
        rawInteractions: rawNodes.filter(n => n.prototypeInteractions?.length || n.symbolData || n.symbolOverrides),
        coveredRuntimeIds: snapshots[2]?.elements.map(e => e.sourceId).filter(Boolean) ?? [] };
      await writeFile(record.evidence[0], JSON.stringify(record, null, 2));
      records.push({ frameId, sourceSha256, dataEvidence: record.dataEvidence, checks: record.checks, evidence: record.evidence,
        family, page: number, partialChecks: record.partialChecks, error: record.error, failedAspect: record.failedAspect,
        scope: { native: 'NOT_RUN', sourceStructureComplete: 'NOT_RUN', sourceFontsComplete: 'NOT_RUN', sourceLayoutComplete: 'NOT_RUN', supportedEffectsComplete: 'NOT_RUN' } });
      await context.close();
    }
  }
  const capabilityPath = '../.superpowers/sdd/2026-11-13-mobile-frontend-source-alignment/capability-final-readonly.json';
  const capabilityBytes = await readFile(capabilityPath);
  const capability = JSON.parse(capabilityBytes.toString());
  const readonlyCapability = { path: capabilityPath, sha256: createHash('sha256').update(capabilityBytes).digest('hex'), snapshot: capability,
    status: 'readonly-api-snapshot', detailChecks: capability.getResults.filter((r: { status: number }) => r.status === 500).map((r: {path: string; status: number}) => ({ ...r, check: 'BACKEND_BLOCKED' })), runtimeRealJob: 'NOT_RUN' };
  const supplemental = [];
  for (const path of ['community-component.json', 'product-safe-area.json']) {
    const artifact = await readFile(`${output}/${path}`).catch(() => null);
    if (artifact) expect(JSON.parse(artifact.toString()).sourceSha256, `${path} source version`).toBe(sourceSha256);
    supplemental.push({ path: `${output}/${path}`, status: artifact ? 'COLLECTED' : 'NOT_RUN',
      sha256: artifact ? createHash('sha256').update(artifact).digest('hex') : null });
  }
  const summary = summarizeSourceAcceptance(records, mobileApprovedFrameIds, sourceSha256);
  await writeFile(`${output}/records.json`, JSON.stringify({ ...summary, sourceSha256, producer, collectedAt: new Date().toISOString(), readonlyCapability, supplemental,
    boundaries: { nativeDevices: 'NOT_RUN', nativeKeyboard: 'NOT_RUN', nativeFontScaling: 'NOT_RUN', sourceRouteMotion: 'NOT_IMPLEMENTED', bottomNavSourceMotion: 'NOT_IMPLEMENTED', glass: 'NOT_IMPLEMENTED', noise: 'NOT_IMPLEMENTED', realJobGeneration: 'NOT_RUN' }, failures }, null, 2));
  await info.attach('source-acceptance-records', { path: `${output}/records.json`, contentType: 'application/json' });
  expect(records).toHaveLength(26); expect(summary.overall).toBe('INCOMPLETE'); expect(failures).toEqual([]);
});
