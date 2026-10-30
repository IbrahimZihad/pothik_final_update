import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_NAME = 'POTHIK';
export const DEFAULT_TITLE = 'POTHIK · Bangladesh travel, planned properly';
export const DEFAULT_DESCRIPTION =
  'Plan hotels, transport, guides and custom trips across Bangladesh with verified providers, server-priced trips and one confirmed itinerary.';
export const DEFAULT_IMAGE = '/og.png';
export const SITE_LOCALE = 'en_US';

export function siteOrigin() {
  if (typeof window === 'undefined' || !window.location) return '';
  return window.location.origin;
}

export function absoluteUrl(value, origin = siteOrigin()) {
  if (!value) return '';
  try {
    return new URL(value, `${origin}/`).toString();
  } catch {
    return value;
  }
}

export function truncate(text, max = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function graph(...nodes) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes.filter(Boolean),
  };
}

export function breadcrumb(items, origin = siteOrigin()) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, origin),
    })),
  };
}

export function collectionPage({ name, description, path, origin = siteOrigin() }) {
  return {
    '@type': 'CollectionPage',
    name,
    description: truncate(description, 300),
    url: absoluteUrl(path, origin),
    inLanguage: 'en',
  };
}

export function defaultGraph(origin = siteOrigin()) {
  return graph(
    {
      '@type': 'Organization',
      '@id': `${origin}/#organization`,
      name: SITE_NAME,
      url: `${origin}/`,
      logo: `${origin}/logo.svg`,
      description: DEFAULT_DESCRIPTION,
    },
    {
      '@type': 'WebSite',
      '@id': `${origin}/#website`,
      url: `${origin}/`,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      inLanguage: ['en', 'bn'],
      publisher: { '@id': `${origin}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${origin}/search?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    }
  );
}

function upsertMeta(attribute, key, content) {
  if (content == null) return;
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    element.setAttribute('data-seo', 'managed');
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function removeMeta(attribute, key) {
  document.head.querySelectorAll(`meta[${attribute}="${key}"]`).forEach((element) => element.remove());
}

function upsertCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.setAttribute('data-seo', 'managed');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertJsonLd(data) {
  let script = document.head.querySelector('script[data-seo-jsonld]');
  if (!script) {
    script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute('data-seo-jsonld', 'true');
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function previewImage(image, origin) {
  // Social scrapers reject SVG, so demo/cover SVGs fall back to the branded PNG.
  if (!image || /\.svg(?:[?#]|$)/i.test(image)) return `${origin}${DEFAULT_IMAGE}`;
  return absoluteUrl(image, origin);
}

export function applyHead({
  title,
  description,
  image,
  url,
  type = 'website',
  noindex = false,
  publishedTime,
  jsonLd,
} = {}) {
  const origin = siteOrigin();
  const fullTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  const summary = truncate(description || DEFAULT_DESCRIPTION, 200);
  const pageUrl = absoluteUrl(url || window.location.pathname, origin);
  const usesDefaultImage = !image || /\.svg(?:[?#]|$)/i.test(image);
  const imageUrl = previewImage(image, origin);

  document.title = fullTitle;

  upsertMeta('name', 'description', summary);
  upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

  upsertMeta('property', 'og:type', type);
  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', summary);
  upsertMeta('property', 'og:url', pageUrl);
  upsertMeta('property', 'og:image', imageUrl);
  upsertMeta('property', 'og:image:alt', title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Bangladesh, planned properly`);
  upsertMeta('property', 'og:locale', SITE_LOCALE);

  if (usesDefaultImage) {
    upsertMeta('property', 'og:image:type', 'image/png');
    upsertMeta('property', 'og:image:width', '1200');
    upsertMeta('property', 'og:image:height', '630');
  } else {
    removeMeta('property', 'og:image:type');
    removeMeta('property', 'og:image:width');
    removeMeta('property', 'og:image:height');
  }

  if (publishedTime) upsertMeta('property', 'article:published_time', publishedTime);
  else removeMeta('property', 'article:published_time');

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', summary);
  upsertMeta('name', 'twitter:image', imageUrl);
  upsertMeta('name', 'twitter:image:alt', title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Bangladesh, planned properly`);

  upsertCanonical(pageUrl);
  upsertJsonLd(jsonLd || defaultGraph(origin));
}

export function resetHead() {
  applyHead();
}

export function useSeo(options = {}) {
  const location = useLocation();
  const signature = JSON.stringify({
    title: options.title || '',
    description: options.description || '',
    image: options.image || '',
    type: options.type || '',
    url: options.url || '',
    noindex: Boolean(options.noindex),
    publishedTime: options.publishedTime || '',
    jsonLd: options.jsonLd || null,
    pathname: location.pathname,
  });

  useEffect(() => {
    applyHead({
      ...options,
      url: options.url || location.pathname,
    });
    return () => resetHead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
