import { parse } from 'node-html-parser';

const months = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];
const rssMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type NewsItem = {
  title: string;
  date: string;
  url: string;
  image?: string;
};

export type NewsSource = {
  name: string;
  origin: string;
  pagePath: string;
  feedPath: string;
  articlePrefix: string;
  imagePrefix: string;
  storageKey: string;
  parseEntries: (body: string) => unknown[];
};

function newsUrl(value: unknown, origin: string, pathPrefix: string) {
  if (typeof value !== 'string') return;
  const input = value.trim();
  const path = input.startsWith(`${origin}/`) ? input.slice(origin.length) : input;
  if (!path.startsWith(pathPrefix) || /[?#\\\r\n\t]/.test(path)) return;
  const url = new URL(path, origin);
  if (url.origin === origin && url.pathname.startsWith(pathPrefix) && url.pathname.length > pathPrefix.length) {
    return url.href;
  }
}

function collectNews(source: NewsSource, candidates: unknown[]): NewsItem[] {
  const items = new Map<string, NewsItem>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const { title, date, url, image } = candidate as Partial<Record<keyof NewsItem, unknown>>;
    const link = newsUrl(url, source.origin, source.articlePrefix);
    if (!link || items.has(link) || typeof title !== 'string' || !title.trim() || typeof date !== 'string' || !date.trim()) continue;
    items.set(link, {
      title: title.replace(/\s+/g, ' ').trim(),
      date: date.replace(/\s+/g, ' ').trim(),
      url: link,
      image: newsUrl(image, source.origin, source.imagePrefix),
    });
    if (items.size === 10) break;
  }
  return [...items.values()];
}

function parseMinistryEntries(html: string) {
  return parse(html).querySelectorAll('#category-view .post-list-item').map(card => {
    const link = card.querySelector('.caption h6 a');
    return {
      title: link?.text,
      date: card.querySelector('.caption small')?.text,
      url: link?.getAttribute('href'),
      image: card.querySelector('.thumbnail img')?.getAttribute('src'),
    };
  });
}

function parseVeteranEntries(xml: string) {
  const root = parse(xml, { voidTag: { tags: [] }, blockTextElements: { 'content:encoded': false } });
  return root.querySelectorAll('rss > channel > item').map(item => ({
    title: item.querySelector('title')?.text,
    date: formatRssDate(item.querySelector('pubdate')?.text.trim()),
    url: item.querySelector('link')?.text,
    image: item.querySelector('enclosure')?.getAttribute('url'),
  }));
}

function formatRssDate(value: string | undefined) {
  // Both publishers give local Ukrainian time, including the RSS date before its offset.
  const match = value?.match(/^(?:[A-Za-z]{3}, )?(\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{2}:\d{2}):\d{2} [+-]\d{4}$/);
  if (!match) return;
  const [, day, month, year, time] = match;
  const monthName = months[rssMonths.indexOf(month)];
  if (monthName) return `${Number(day)} ${monthName} ${year}, ${time}`;
}

export const ministryNews: NewsSource = {
  name: 'Мінветеранів України',
  origin: 'https://mva.gov.ua',
  pagePath: '/category/86-novini',
  feedPath: '/category/86-novini',
  articlePrefix: '/prescenter/category/86-novini/',
  imagePrefix: '/media/',
  storageKey: 'nezlamnyi-ministry-news-v1',
  parseEntries: parseMinistryEntries,
};

export const veteranNews: NewsSource = {
  name: '«Ветеран»',
  origin: 'https://veteran.com.ua',
  pagePath: '/news/novyny',
  feedPath: '/feed/',
  articlePrefix: '/news/view/',
  imagePrefix: '/uploads/news/',
  storageKey: 'nezlamnyi-veteran-news-v1',
  parseEntries: parseVeteranEntries,
};

export function parseNews(source: NewsSource, body: string) {
  return collectNews(source, source.parseEntries(body));
}

export function readNewsCache(source: NewsSource, raw: string | null) {
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(data) ? collectNews(source, data) : [];
  } catch {
    return [];
  }
}

function publicationOrder(date: string) {
  const match = date.match(/^(\d{1,2}) (\S+) (\d{4}), (\d{2}):(\d{2})$/);
  if (!match) return -Infinity;
  const [, day, month, year, hour, minute] = match;
  const monthIndex = months.indexOf(month);
  return monthIndex < 0 ? -Infinity : Date.UTC(Number(year), monthIndex, Number(day), Number(hour), Number(minute));
}

export function sortNews<T extends NewsItem>(items: T[]) {
  return items.sort((left, right) => publicationOrder(right.date) - publicationOrder(left.date));
}

export async function fetchNews(source: NewsSource, signal: AbortSignal) {
  const response = await fetch(`${source.origin}${source.feedPath}`, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error(`News source returned HTTP ${response.status}`);
  const items = parseNews(source, await response.text());
  if (!items.length) throw new Error('News source contained no usable entries');
  return items;
}
