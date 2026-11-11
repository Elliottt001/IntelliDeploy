import { describe, expect, test } from 'vitest';
import { mobileEvidence } from '../design/mobileEvidence';
import { mobileColors, mobileRadii } from '../theme/tokens';
import { getMobileLayout } from '../theme/responsive';

describe('mobile design evidence', () => {
  test('pins every formal family to approved pages and real frame ids', () => {
    expect(mobileEvidence.login.pages).toEqual(['page-01']);
    expect(mobileEvidence.home.pages).toEqual([
      'page-02',
      'page-29',
      'page-30',
      'page-31',
      'page-32',
      'page-33',
      'page-34',
      'page-35',
    ]);
    expect(mobileEvidence.store.pages).toEqual(['page-03', 'page-40']);
    expect(mobileEvidence.chatbot.pages).toEqual([
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
    ]);
    expect(mobileEvidence.chatbot.frameIds).toContain('852:4242');
    expect(mobileEvidence.products.pages).toEqual(['page-56', 'page-57']);
    expect(mobileEvidence.community.pages).toEqual(['page-59', 'page-60']);

    for (const evidence of Object.values(mobileEvidence)) {
      expect(evidence.frameIds).toHaveLength(evidence.pages.length);
      expect(evidence.frameIds.every((id) => /^\d+:\d+$/.test(id))).toBe(true);
      expect(evidence.size).toEqual([375, 812]);
    }
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
});
