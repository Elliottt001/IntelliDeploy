import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { marketingHomeEvidence } from '../design/marketing-home';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('marketing design evidence', () => {
  test('pins every formal homepage section to its Figma node', () => {
    expect(marketingHomeEvidence.root).toBe('100:4630');
    expect(marketingHomeEvidence.sections.map((section) => section.node)).toEqual([
      '100:5063', '100:5099', '100:5107', '100:5114',
      '100:5329', '100:5496', '100:5547', '100:5549',
    ]);
    expect(marketingHomeEvidence.pricing).toEqual({ frame: '100:5547', instance: '100:5548', symbol: '100:2691' });
  });

  test('ships only reviewed assets and distributable fonts', () => {
    for (const file of marketingHomeEvidence.assets) {
      const path = `${webRoot}/${file.target}`;
      expect(existsSync(path), file.target).toBe(true);
      expect(sha256(path), file.target).toBe(file.sha256);
    }
    for (const font of marketingHomeEvidence.fonts) {
      expect(existsSync(`${webRoot}/${font.target}`), font.target).toBe(true);
    }
    expect(existsSync(`${webRoot}/assets/fonts/PingFangUI.ttc`)).toBe(false);
    expect(marketingHomeEvidence.assets.some((asset) => asset.target.includes('New：Home'))).toBe(false);
  });
});
