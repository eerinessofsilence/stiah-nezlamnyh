import { parse } from 'node-html-parser';

const ministryOrigin = 'https://mva.gov.ua';
export const ministryNewsUrl = `${ministryOrigin}/category/86-novini`;

export type MinistryNewsItem = {
  title: string;
  date: string;
  url: string;
  image?: string;
};

function ministryUrl(value: unknown, pathPrefix: string) {
  if (typeof value !== 'string') return;
  const path = value.trim().replace(/^https:\/\/mva\.gov\.ua(?=\/)/, '');
  if (!path.startsWith(pathPrefix) || /[?#\\\r\n\t]/.test(path)) return;
  const url = new URL(path, ministryOrigin);
  if (url.origin === ministryOrigin && url.pathname.startsWith(pathPrefix) && url.pathname.length > pathPrefix.length) {
    return url.href;
  }
}

function collectNews(candidates: unknown[]): MinistryNewsItem[] {
  const items = new Map<string, MinistryNewsItem>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const { title, date, url, image } = candidate as Partial<Record<keyof MinistryNewsItem, unknown>>;
    const link = ministryUrl(url, '/prescenter/category/86-novini/');
    if (!link || items.has(link) || typeof title !== 'string' || !title.trim() || typeof date !== 'string' || !date.trim()) continue;
    items.set(link, { title: title.replace(/\s+/g, ' ').trim(), date: date.trim(), url: link, image: ministryUrl(image, '/media/') });
    if (items.size === 10) break;
  }
  return [...items.values()];
}

export function parseMinistryNews(html: string) {
  return collectNews(parse(html).querySelectorAll('#category-view .post-list-item').map(card => {
    const link = card.querySelector('.caption h6 a');
    return {
      title: link?.text,
      date: card.querySelector('.caption small')?.text,
      url: link?.getAttribute('href'),
      image: card.querySelector('.thumbnail img')?.getAttribute('src'),
    };
  }));
}

export function readMinistryNewsCache(raw: string | null) {
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(data) ? collectNews(data) : [];
  } catch {
    return [];
  }
}

export async function fetchMinistryNews(signal: AbortSignal) {
  const response = await fetch(ministryNewsUrl, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`Ministry news returned HTTP ${response.status}`);
  const items = parseMinistryNews(await response.text());
  if (!items.length) throw new Error('Ministry news page contained no usable entries');
  return items;
}
