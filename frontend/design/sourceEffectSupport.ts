export type EffectSupport = 'PASS' | 'NOT_IMPLEMENTED' | 'NOT_RUN';

const webSupported = new Set([
  'GLASS',
  'NOISE',
  'BACKGROUND_BLUR',
  'DROP_SHADOW',
  'FOREGROUND_BLUR',
  'INNER_SHADOW',
]);

const nativeImplementedNotRun = new Set([
  'GLASS',
  'NOISE',
  'DROP_SHADOW',
  'FOREGROUND_BLUR',
  'INNER_SHADOW',
]);

export function effectSupport(
  rawEffectType: string,
  platform: 'web' | 'ios' | 'android',
): EffectSupport {
  if (platform !== 'web') {
    return nativeImplementedNotRun.has(rawEffectType) ? 'NOT_RUN' : 'NOT_IMPLEMENTED';
  }
  return webSupported.has(rawEffectType) ? 'PASS' : 'NOT_IMPLEMENTED';
}
