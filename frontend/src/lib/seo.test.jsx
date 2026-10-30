import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderHook } from '@testing-library/react';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  absoluteUrl,
  applyHead,
  breadcrumb,
  defaultGraph,
  resetHead,
  truncate,
  useSeo,
} from './seo';

const origin = window.location.origin;
const meta = (attribute, key) =>
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.getAttribute('content') ?? null;
const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
const jsonLd = () => JSON.parse(document.head.querySelector('script[data-seo-jsonld]').textContent);

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = '';
});

describe('seo helpers', () => {
  it('absolutizes relative URLs and leaves absolute URLs untouched', () => {
    expect(absoluteUrl('/images/destinations/coxs-bazar.svg')).toBe(`${origin}/images/destinations/coxs-bazar.svg`);
    expect(absoluteUrl('https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg');
    expect(absoluteUrl('')).toBe('');
  });

  it('truncates long text to the requested length', () => {
    expect(truncate('short', 10)).toBe('short');
    const result = truncate('a'.repeat(50), 10);
    expect(result).toHaveLength(10);
    expect(result.endsWith('…')).toBe(true);
  });

  it('builds breadcrumbs with positions and absolute item URLs', () => {
    const list = breadcrumb([
      { name: 'Home', path: '/' },
      { name: 'Destinations', path: '/destinations' },
      { name: "Cox's Bazar", path: '/destinations/coxs-bazar' },
    ]);
    expect(list['@type']).toBe('BreadcrumbList');
    expect(list.itemListElement).toHaveLength(3);
    expect(list.itemListElement[1]).toMatchObject({ position: 2, name: 'Destinations', item: `${origin}/destinations` });
  });

  it('applies title, description, OG, Twitter, canonical and a default WebSite graph', () => {
    applyHead({
      title: "Cox's Bazar",
      description: "Bangladesh's longest sea beach, planned end to end.",
      url: '/destinations/coxs-bazar',
    });

    expect(document.title).toBe("Cox's Bazar · POTHIK");
    expect(meta('name', 'description')).toContain('longest sea beach');
    expect(meta('name', 'robots')).toBe('index, follow');
    expect(meta('property', 'og:title')).toBe("Cox's Bazar · POTHIK");
    expect(meta('property', 'og:url')).toBe(`${origin}/destinations/coxs-bazar`);
    expect(meta('property', 'og:image')).toBe(`${origin}/og.png`);
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(canonical()).toBe(`${origin}/destinations/coxs-bazar`);
    expect(jsonLd()['@graph'].map((node) => node['@type'])).toEqual(['Organization', 'WebSite']);
  });

  it('uses raster cover images and drops fixed default dimensions', () => {
    applyHead({ title: 'Sea Crown', image: '/uploads/hotel.jpg' });

    expect(meta('property', 'og:image')).toBe(`${origin}/uploads/hotel.jpg`);
    expect(meta('property', 'og:image:width')).toBeNull();
    expect(meta('property', 'og:image:height')).toBeNull();
  });

  it('falls back to the branded PNG for SVG covers that social scrapers reject', () => {
    applyHead({ title: 'Sajek Valley', image: '/images/destinations/sajek.svg' });
    expect(meta('property', 'og:image')).toBe(`${origin}/og.png`);
    expect(meta('property', 'og:image:type')).toBe('image/png');
  });

  it('marks private pages noindex and resets to the site defaults', () => {
    applyHead({ title: 'Dashboard', noindex: true });
    expect(meta('name', 'robots')).toBe('noindex, nofollow');

    resetHead();
    expect(document.title).toBe(DEFAULT_TITLE);
    expect(meta('name', 'description')).toBe(DEFAULT_DESCRIPTION);
    expect(meta('name', 'robots')).toBe('index, follow');
    expect(canonical()).toBe(`${origin}/`);
    expect(jsonLd()).toEqual(defaultGraph(origin));
  });
});

describe('useSeo', () => {
  it('applies page metadata on mount and restores defaults on unmount', () => {
    const wrapper = ({ children }) => (
      <MemoryRouter initialEntries={['/destinations']}>{children}</MemoryRouter>
    );

    const { unmount } = renderHook(
      () => useSeo({ title: 'Destinations in Bangladesh', description: 'Beaches and hill tracts.' }),
      { wrapper }
    );

    expect(document.title).toBe('Destinations in Bangladesh · POTHIK');
    expect(canonical()).toBe(`${origin}/destinations`);

    unmount();
    expect(document.title).toBe(DEFAULT_TITLE);
  });
});
