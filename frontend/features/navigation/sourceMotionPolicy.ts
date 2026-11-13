import type { SourceMotion } from '../../design/sourceMotionEvidence';

export type SourceTransitionReason =
  | 'interaction'
  | 'snapshot'
  | 'prototype-timer';

export function shouldStartSourceTransition(
  motion: SourceMotion,
  reason: SourceTransitionReason,
  previousState: string,
  nextState: string,
): boolean {
  if (reason === 'prototype-timer') {
    return false;
  }
  if (reason === 'snapshot') {
    return previousState !== nextState;
  }
  return motion.event !== 'AFTER_TIMEOUT';
}

function assertDuration(motion: SourceMotion) {
  if (!Number.isFinite(motion.durationMs) || motion.durationMs < 0) {
    throw new Error('Invalid source duration');
  }
}

export function sampleSourceEasing(motion: SourceMotion, input: number): number {
  assertDuration(motion);
  const t = Math.max(0, Math.min(1, input));
  if (t === 0 || t === 1 || motion.durationMs === 0) {
    return t;
  }

  const parameters = motion.easingFunction;
  if (motion.easingType?.includes('SPRING')) {
    const [mass, stiffness, damping, velocity] = parameters;
    if (
      parameters.length !== 4 ||
      !parameters.every(Number.isFinite) ||
      mass <= 0 ||
      stiffness <= 0 ||
      damping < 0
    ) {
      throw new Error('Unsupported source spring');
    }

    const alpha = damping / (2 * mass);
    const omega2 = stiffness / mass;
    const response = (seconds: number) => {
      const delta = omega2 - alpha * alpha;
      let displacement: number;

      if (Math.abs(delta) < 1e-8) {
        displacement =
          Math.exp(-alpha * seconds) * (1 + (alpha - velocity) * seconds);
      } else if (delta > 0) {
        const omega = Math.sqrt(delta);
        displacement =
          Math.exp(-alpha * seconds) *
          (Math.cos(omega * seconds) +
            ((alpha - velocity) / omega) * Math.sin(omega * seconds));
      } else {
        const root = Math.sqrt(-delta);
        const a = -alpha + root;
        const b = -alpha - root;
        const ca = (-velocity - b) / (a - b);
        const cb = 1 - ca;
        displacement = ca * Math.exp(a * seconds) + cb * Math.exp(b * seconds);
      }

      return 1 - displacement;
    };

    const seconds = motion.durationMs / 1000;
    const end = response(seconds);
    if (!Number.isFinite(end) || Math.abs(end) < 1e-8) {
      throw new Error('Unresolvable source spring duration');
    }
    return response(t * seconds) / end;
  }

  if (motion.easingType === 'LINEAR') {
    return t;
  }

  if (
    parameters.length !== 4 ||
    !parameters.every(Number.isFinite) ||
    !motion.easingType?.includes('CUBIC')
  ) {
    throw new Error('Unsupported source easing');
  }

  const [x1, y1, x2, y2] = parameters;
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new Error('Invalid source bezier');
  }

  const value = (u: number, a: number, b: number) =>
    3 * (1 - u) * (1 - u) * u * a +
    3 * (1 - u) * u * u * b +
    u * u * u;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (value(mid, x1, x2) < t) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return value((low + high) / 2, y1, y2);
}
