export type EffectSupport = 'PASS' | 'NOT_IMPLEMENTED' | 'NOT_RUN';

const webSupported = new Set([
  'BACKGROUND_BLUR',
  'DROP_SHADOW',
  'FOREGROUND_BLUR',
  'INNER_SHADOW',
]);

const nativeImplementedNotRun = new Set([
  'DROP_SHADOW',
  'FOREGROUND_BLUR',
  'INNER_SHADOW',
]);

export function effectSupport(
  rawEffectType: string,
  platform: 'web' | 'ios' | 'android',
): EffectSupport {
  if (rawEffectType === 'GLASS' || rawEffectType === 'NOISE') {
    return 'NOT_IMPLEMENTED';
  }
  if (platform !== 'web') {
    return nativeImplementedNotRun.has(rawEffectType) ? 'NOT_RUN' : 'NOT_IMPLEMENTED';
  }
  return webSupported.has(rawEffectType) ? 'PASS' : 'NOT_IMPLEMENTED';
}
