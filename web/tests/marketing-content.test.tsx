import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { marketingCopy } from '../components/marketing/content';
import HeroSection from '../components/marketing/HeroSection';

const forbidden = ['381032', '5289', '2319', 'Cummunitty', 'Calyra', 'Mindful Start', 'Brightwave', 'Alice'];

describe('marketing copy', () => {
  test('contains only real routes and no Figma placeholder claims', () => {
    const serialized = JSON.stringify(marketingCopy);
    forbidden.forEach((value) => expect(serialized).not.toContain(value));
    expect(marketingCopy.hero.primaryHref).toBe('/create');
    expect(marketingCopy.hero.secondaryHref).toBe('/community');
    expect(serialized).not.toContain('href":"#"');
  });

  test('hero exposes one page heading and both real calls to action', () => {
    const html = renderToStaticMarkup(<HeroSection />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/community"');
  });
});
