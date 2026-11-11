import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    select: (options: Record<string, string>) => options.default,
  },
}));

import { mobileEvidence } from '../design/mobileEvidence';
import { approvedRootIds } from '../scripts/extract-mobile-design-evidence.mjs';
import { mobileColors, mobileRadii } from '../theme/tokens';
import { getMobileLayout } from '../theme/responsive';
import {
  mobileFontFamilies,
  mobileTypography,
} from '../theme/typography';

describe('mobile design evidence', () => {
  test('pins every formal family to approved pages and real frame ids', () => {
    expect(mobileEvidence).toEqual({
      login: {
        pages: ['page-01'],
        frameIds: ['119:76618'],
        size: [375, 812],
      },
      home: {
        pages: [
          'page-02',
          'page-29',
          'page-30',
          'page-31',
          'page-32',
          'page-33',
          'page-34',
          'page-35',
        ],
        frameIds: [
          '270:26263',
          '188:16287',
          '188:16759',
          '266:21147',
          '268:22904',
          '268:23238',
          '268:23572',
          '268:23906',
        ],
        size: [375, 812],
      },
      store: {
        pages: ['page-03', 'page-40'],
        frameIds: ['270:26597', '825:6804'],
        size: [375, 812],
      },
      chatbot: {
        pages: [
          'page-46',
          'page-47',
          'page-48',
          'page-49',
          'page-50',
          'page-51',
          'page-52',
          'page-53',
          'page-54',
          'page-55',
          'page-58',
        ],
        frameIds: [
          '845:3479',
          '846:3544',
          '849:3608',
          '849:3705',
          '849:3794',
          '849:3883',
          '849:3972',
          '852:4061',
          '852:4150',
          '852:4242',
          '852:4391',
        ],
        size: [375, 812],
      },
      products: {
        pages: ['page-56', 'page-57'],
        frameIds: ['168:6299', '380:147'],
        size: [375, 812],
      },
      community: {
        pages: ['page-59', 'page-60'],
        frameIds: ['168:6358', '825:6452'],
        size: [375, 812],
      },
    });

    for (const evidence of Object.values(mobileEvidence)) {
      expect(evidence.frameIds).toHaveLength(evidence.pages.length);
      expect(evidence.frameIds.every((id) => /^\d+:\d+$/.test(id))).toBe(true);
      expect(evidence.size).toEqual([375, 812]);
    }
    expect(approvedRootIds).toEqual(
      Object.values(mobileEvidence).flatMap((evidence) => evidence.frameIds),
    );
  });

  test('uses canonical tokens and responsive gutters without canvas scaling', () => {
    expect(mobileColors.primary).toBe('#7C62FF');
    expect(mobileColors.text).toBe('#494A64');
    expect(mobileRadii.card).toEqual({ min: 20, max: 30 });
    expect(getMobileLayout(320, { left: 0, right: 0 })).toMatchObject({
      gutter: 16,
      contentWidth: 288,
      scale: 1,
    });
    expect(getMobileLayout(430, { left: 0, right: 0 })).toMatchObject({
      gutter: 24,
      contentWidth: 382,
      scale: 1,
    });
  });

  test('defines the approved typography aliases and metrics', () => {
    expect(mobileFontFamilies).toMatchObject({
      display: 'ZiTiQuanWeiJunHei',
      body: 'AlibabaPuHuiTiRegular',
      emphasis: 'AlibabaPuHuiTiSemiBold',
    });
    expect(mobileFontFamilies.pingFang).toBeTruthy();
    expect(mobileFontFamilies.inter).toBeTruthy();
    expect(mobileTypography).toEqual({
      display: {
        fontFamily: 'ZiTiQuanWeiJunHei',
        fontSize: 32,
        lineHeight: 40,
      },
      title: {
        fontFamily: 'AlibabaPuHuiTiSemiBold',
        fontSize: 22,
        lineHeight: 30,
      },
      body: {
        fontFamily: 'AlibabaPuHuiTiRegular',
        fontSize: 16,
        lineHeight: 24,
      },
      caption: {
        fontFamily: 'AlibabaPuHuiTiRegular',
        fontSize: 13,
        lineHeight: 19,
      },
    });
  });

  test('keeps the generated mobile asset manifest non-empty and local', async () => {
    const manifest = await readFile(
      path.resolve('design/generated/mobileAssetManifest.ts'),
      'utf8',
    );
    const entries = manifest.match(
      /source: require\("\.\.\/\.\.\/assets\/mobile\/generated\/[^"\n]+"\)/g,
    );

    expect(manifest).toContain('export const mobileAssets = {');
    expect(entries?.length).toBeGreaterThan(0);
    expect(manifest).not.toMatch(/https?:\/\//);
  });

  test('registers only the approved tracked font files in the root layout', async () => {
    const layout = await readFile(
      path.resolve('app/_layout.tsx'),
      'utf8',
    );
    const registeredFonts = [...layout.matchAll(/assets\/fonts\/([^']+)'\)/g)]
      .map((match) => match[1])
      .sort();
    const expectedFonts = [
      'Alibaba_PuHuiTi_2.0_35_Thin_35_Thin.ttf',
      'Alibaba_PuHuiTi_2.0_45_Light_45_Light.ttf',
      'Alibaba_PuHuiTi_2.0_55_Regular_55_Regular.ttf',
      'Alibaba_PuHuiTi_2.0_55_Regular_85_Bold.ttf',
      'Alibaba_PuHuiTi_2.0_75_SemiBold_75_SemiBold.ttf',
      'ZiTiQuanWeiJunHei-W3.ttf',
    ];

    expect(registeredFonts).toEqual(expectedFonts);
    for (const font of registeredFonts) {
      expect(() =>
        execFileSync(
          'git',
          ['ls-files', '--error-unmatch', `frontend/assets/fonts/${font}`],
          { cwd: path.resolve('..'), stdio: 'pipe' },
        ),
      ).not.toThrow();
    }
  });
});
