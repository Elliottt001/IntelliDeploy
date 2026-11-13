import { describe, expect, test } from 'vitest';

import { figmaComponentEvidence } from '../design/figmaComponentEvidence';
import { homeRenderEvidence } from '../design/homeRenderEvidence';
import { effectSupport } from '../design/sourceEffectSupport';
import { sourceNode } from './figmaSource';

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

  test('supported renderer effects keep source RGBA color and alpha alongside display color', () => {
    const raw = sourceNode('270:26319').effects.find(
      (effect: any) => effect.type === 'INNER_SHADOW',
    );
    const actual = homeRenderEvidence.clouds[0].background.geometry
      .find((layer) => layer.sourceNodeId === '270:26319')
      ?.sourceEffects?.find((effect) => effect.rawType === 'INNER_SHADOW');

    expect(actual?.color).toBe('#FFFFFF');
    expect(actual?.sourceColor).toEqual({
      a: raw.color.a,
      b: raw.color.b,
      g: raw.color.g,
      r: raw.color.r,
    });
    expect(actual?.opacity).toBeCloseTo(raw.color.a, 6);
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

  test('effect support is based on renderer capability, not raw metadata presence', () => {
    expect(effectSupport('DROP_SHADOW', 'web')).toBe('PASS');
    expect(effectSupport('DROP_SHADOW', 'ios')).toBe('NOT_RUN');
    expect(effectSupport('INNER_SHADOW', 'web')).toBe('PASS');
    expect(effectSupport('FOREGROUND_BLUR', 'web')).toBe('PASS');
    expect(effectSupport('BACKGROUND_BLUR', 'web')).toBe('PASS');
    expect(effectSupport('BACKGROUND_BLUR', 'ios')).toBe('NOT_IMPLEMENTED');
    expect(effectSupport('LAYER_BLUR', 'web')).toBe('NOT_IMPLEMENTED');
    expect(effectSupport('GLASS', 'web')).toBe('PASS');
    expect(effectSupport('NOISE', 'web')).toBe('PASS');
    expect(effectSupport('GLASS','ios')).toBe('NOT_RUN');
    expect(effectSupport('NOISE','android')).toBe('NOT_RUN');
    expect(effectSupport('FUTURE_EFFECT', 'ios')).toBe('NOT_IMPLEMENTED');
  });

  test('source effect normalization preserves complete raw payload including nested unknowns and visibility', async () => {
    const { normalizeSourceEffect } = await import(
      '../scripts/extract-mobile-component-evidence.mjs'
    );
    const rawNoise = sourceNode('270:26319').effects.find(
      (effect: any) => effect.type === 'NOISE',
    );
    const raw = {
      ...rawNoise,
      color: { ...rawNoise.color, unknownChannel: 17 },
      noiseSize: { ...rawNoise.noiseSize, unknownAxis: 9 },
      offset: { ...rawNoise.offset, unknownZ: 3 },
      styleId: { guid: { localID: 1, sessionID: 2 }, unknownMetadata: 'kept' },
      visible: true,
    };
    const actual = normalizeSourceEffect(raw, '270:26319');

    expect(actual).not.toBeNull();
    if (!actual) {
      throw new Error('expected visible source effect to normalize');
    }
    expect(actual.rawPayload).toMatchObject({
      color: { unknownChannel: 17 },
      noiseSize: { unknownAxis: 9 },
      offset: { unknownZ: 3 },
      styleId: { unknownMetadata: 'kept' },
      visible: true,
    });
    expect(actual.visible).toBe(true);
  });
});
