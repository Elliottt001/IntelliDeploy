import { describe, expect, test } from 'vitest';

import { figmaComponentEvidence } from '../design/figmaComponentEvidence';
import { homeRenderEvidence } from '../design/homeRenderEvidence';
import { sourceNode } from './figmaSource';

async function loadEffectSupport() {
  try {
    return await import('../design/sourceEffectSupport');
  } catch {
    return {
      effectSupport: () => 'MISSING',
    };
  }
}

describe('source paint, mask, and effect preservation', () => {
  test('glass remains glass with its original optical values', () => {
    const raw = sourceNode('270:26624').effects.find(
      (effect: any) => effect.type === 'GLASS',
    );
    const actual = homeRenderEvidence.sourceEffectSamples.storeSearchSurface.effects.find(
      (effect) => effect.rawType === 'GLASS',
    );

    expect(actual).toMatchObject({ rawType: 'GLASS', type: 'GLASS' });
    expect(actual?.refractionRadius).toBeCloseTo(raw.refractionRadius, 6);
    expect(actual?.refractionIntensity).toBeCloseTo(raw.refractionIntensity, 6);
    expect(actual?.specularIntensity).toBeCloseTo(raw.specularIntensity, 6);
    expect(actual?.chromaticAberration).toBeCloseTo(raw.chromaticAberration, 6);
    expect(actual?.seed).toBe(raw.seed);
    expect(actual?.density).toBeCloseTo(raw.density, 6);
    expect(actual?.noiseSize).toEqual({ x: raw.noiseSize.x, y: raw.noiseSize.y });
  });

  test('noise effect keeps source order, seed, density, and optical fields', () => {
    const rawEffects = sourceNode('270:26319').effects.filter(
      (effect: any) => effect.visible !== false,
    );
    const actualEffects = homeRenderEvidence.clouds[0].background.geometry.find(
      (layer) => layer.sourceNodeId === '270:26319',
    )?.sourceEffects;

    expect(actualEffects?.map((effect) => effect.rawType)).toEqual(
      rawEffects.map((effect: any) => effect.type),
    );
    const rawNoise = rawEffects.find((effect: any) => effect.type === 'NOISE');
    const actualNoise = actualEffects?.find((effect) => effect.rawType === 'NOISE');
    expect(actualNoise).toMatchObject({ rawType: 'NOISE', type: 'NOISE' });
    expect(actualNoise?.seed).toBe(rawNoise.seed);
    expect(actualNoise?.density).toBeCloseTo(rawNoise.density, 6);
    expect(actualNoise?.noiseSize).toEqual({ x: rawNoise.noiseSize.x, y: rawNoise.noiseSize.y });
    expect(actualNoise?.refractionRadius).toBeCloseTo(rawNoise.refractionRadius, 6);
    expect(actualNoise?.chromaticAberration).toBeCloseTo(rawNoise.chromaticAberration, 6);
  });

  test('glass card consumes source shell padding and supported backdrop blur evidence', () => {
    const shell = sourceNode('825:6570');
    const rawBackdrop = shell.effects.find(
      (effect: any) => effect.type === 'BACKGROUND_BLUR',
    );
    const actualBackdrop = figmaComponentEvidence.glassCard.surfaceEffects?.find(
      (effect) => effect.rawType === 'BACKGROUND_BLUR',
    );

    expect(figmaComponentEvidence.glassCard.sourcePadding).toEqual({
      bottom: shell.stackPaddingBottom,
      left: shell.stackHorizontalPadding,
      right: shell.stackPaddingRight,
      top: shell.stackVerticalPadding,
    });
    expect(actualBackdrop).toMatchObject({ rawType: 'BACKGROUND_BLUR', type: 'BACKGROUND_BLUR' });
    expect(actualBackdrop?.radius).toBe(rawBackdrop.radius);
  });

  test('effect support is based on renderer capability, not raw metadata presence', async () => {
    const { effectSupport } = await loadEffectSupport();

    expect(effectSupport('DROP_SHADOW', 'web')).toBe('PASS');
    expect(effectSupport('DROP_SHADOW', 'ios')).toBe('NOT_RUN');
    expect(effectSupport('BACKGROUND_BLUR', 'web')).toBe('PASS');
    expect(effectSupport('GLASS', 'web')).toBe('NOT_IMPLEMENTED');
    expect(effectSupport('NOISE', 'web')).toBe('NOT_IMPLEMENTED');
  });
});
