const assert = require('node:assert/strict');
const test = require('node:test');

const { ministryNews, veteranNews, parseNews, readNewsCache, sortNews } = require('../src/news.ts');

const article = '/prescenter/category/86-novini/announcement';
const item = {
  title: 'Оновлення «Кар’єра ветерана»',
  date: '24 листопада 2026, 12:07',
  url: `https://mva.gov.ua${article}`,
  image: 'https://mva.gov.ua/media/1/news.jpg',
};

function card(href, image = '/media/1/news.jpg') {
  return `<div class="post-list-item"><div class="thumbnail">
    <img src="${image}">
    <div class="caption"><small>24 листопада 2026, 12:07</small>
      <h6><a href="${href}">Оновлення «Кар&#8217;єра &nbsp;ветерана»</a></h6>
    </div>
  </div></div>`;
}

test('ministry feed extracts and deduplicates official news cards', () => {
  const html = `${card(`${article}-outside`)}<article id="category-view">
    ${card(article)}${card(item.url)}${card(`https://example.org${article}`)}
    ${card(`${article}-second`, '//example.org/photo.jpg')}
  </article>`;
  assert.deepEqual(parseNews(ministryNews, html), [item, { ...item, url: `${item.url}-second`, image: undefined }]);
  assert.deepEqual(parseNews(ministryNews, '<p>Service unavailable</p>'), []);
});

test('offline news accepts saved ministry cards and ignores invalid entries', () => {
  assert.deepEqual(readNewsCache(ministryNews, JSON.stringify([
    item, item, { ...item, url: 'https://example.org/news' }, { ...item, date: '' }, null,
  ])), [item]);
  assert.deepEqual(readNewsCache(ministryNews, '{bad JSON'), []);
});

test('veteran RSS extracts headline cards, validates links and restores the offline feed', () => {
  const news = {
    title: 'Новини & події',
    date: '24 листопада 2026, 20:20',
    url: 'https://veteran.com.ua/news/view/article',
    image: 'https://veteran.com.ua/uploads/news/photo.jpg',
  };
  const rssItem = (url, image, date = 'Tue, 24 Nov 2026 20:20:00 +0200') => `<item>
    <title>Новини &amp; події</title><link>${url}</link><pubDate>${date}</pubDate>
    <enclosure url="${image}" type="image/jpeg"/>
    <content:encoded><![CDATA[<p>Текст статті</p>]]></content:encoded>
  </item>`;
  const xml = `<rss><channel><link>https://veteran.com.ua/</link>
    ${rssItem(news.url, news.image)}${rssItem('/news/view/article', news.image)}
    ${rssItem('https://example.org/news/view/article', news.image)}
    ${rssItem('/news/view/missing-date', news.image, '')}
    ${rssItem('/news/view/second', 'https://example.org/photo.jpg')}
  </channel></rss>`;
  const parsed = parseNews(veteranNews, xml);
  assert.deepEqual(parsed, [news, { ...news, url: 'https://veteran.com.ua/news/view/second', image: undefined }]);
  assert.deepEqual(readNewsCache(veteranNews, JSON.stringify([item, ...parsed])), parsed);
  assert.deepEqual(sortNews([item, ...parsed]), [...parsed, item]);
});
