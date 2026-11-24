const assert = require('node:assert/strict');
const test = require('node:test');

const { parseMinistryNews, readMinistryNewsCache } = require('../src/ministry-news.ts');

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
  assert.deepEqual(parseMinistryNews(html), [item, { ...item, url: `${item.url}-second`, image: undefined }]);
  assert.deepEqual(parseMinistryNews('<p>Service unavailable</p>'), []);
});

test('offline news accepts saved ministry cards and ignores invalid entries', () => {
  assert.deepEqual(readMinistryNewsCache(JSON.stringify([
    item, item, { ...item, url: 'https://example.org/news' }, { ...item, date: '' }, null,
  ])), [item]);
  assert.deepEqual(readMinistryNewsCache('{bad JSON'), []);
});
