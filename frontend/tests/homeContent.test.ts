import { expect, test } from 'vitest';

import { homeCards, homeSuggestions } from '../features/home/homeContent';

test('home content is honest static inspiration and routes to approved destinations', () => {
  expect(homeSuggestions.every((item) => item.source === 'curated')).toBe(true);
  expect(homeCards.map(({ key, href }) => [key, href])).toEqual([
    ['store', '/store'],
    ['products', '/app-gallery'],
    ['community', '/community'],
    ['profile', '/app-gallery'],
  ]);
});
