export type EffectSupport = 'PASS' | 'NOT_IMPLEMENTED' | 'NOT_RUN';

const webSupported = new Set([
  'BACKGROUND_BLUR',
  'DROP_SHADOW',
  'FOREGROUND_BLUR',
  'INNER_SHADOW',
  'LAYER_BLUR',
]);

export function effectSupport(
  rawEffectType: string,
  platform: 'web' | 'ios' | 'android',
): EffectSupport {
  if (rawEffectType === 'GLASS' || rawEffectType === 'NOISE') {
    return 'NOT_IMPLEMENTED';
  }
  if (platform !== 'web') {
    return 'NOT_RUN';
  }
  return webSupported.has(rawEffectType) ? 'PASS' : 'NOT_IMPLEMENTED';
}
