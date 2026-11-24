const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const catalog = require('../../catalog.js');

const ids = new Set(catalog.services.map(({id}) => id));
const groups = new Set(catalog.groups.map(({id}) => id));
assert.equal(ids.size, catalog.services.length, 'Duplicate route ID');
assert(catalog.featured.every(id => ids.has(id)), 'Unknown featured route');
function checkAction(action, owner) {
  if (!action) return;
  const [destination, label] = action;
  assert(label && (destination === 'contacts' || Object.hasOwn(catalog.sources, destination) || /^tel:\+?\d+$/.test(destination)),
    `Invalid practical action: ${owner}`);
}
for (const service of catalog.services) {
  assert.match(service.id, /^[a-z-]+$/);
  assert(groups.has(service.group) && service.related.every(id => ids.has(id) && id !== service.id), `Invalid route links: ${service.id}`);
  assert(service.title && service.desc && service.steps.every(Boolean) && service.steps.length >= 2,
    `Missing route content: ${service.id}`);
  assert(service.sections.length && service.sections.every(({ title, paragraphs }) => title && paragraphs.length && paragraphs.every(Boolean)),
    `Missing guide sections: ${service.id}`);

  const sections = new Set(service.sections.map(({id}) => id));
  assert.equal(sections.size, service.sections.length, `Duplicate section: ${service.id}`);
  checkAction(service.action, service.id);
  for (const section of service.sections) {
    assert.match(section.id, /^[a-z-]+$/);
    assert(section.keys, `Missing search terms: ${service.id}/${section.id}`);
    assert(section.source?.every(key => Object.hasOwn(catalog.sources, key)) ?? true, `Unknown section sources: ${service.id}/${section.id}`);
    checkAction(section.action, `${service.id}/${section.id}`);
  }
  if (catalog.preparation[service.id]?.section) {
    assert(sections.has(catalog.preparation[service.id].section), `Unknown checklist section: ${service.id}`);
  }
  assert(service.source.length, `Missing sources: ${service.id}`);
  for (const key of service.source) {
    assert(Object.hasOwn(catalog.sources, key), `Unknown source: ${key}`);
  }
}

for (const [id, checklist] of Object.entries(catalog.preparation)) {
  const [route, section] = id.split(':');
  assert(ids.has(route), `Unknown checklist service: ${id}`);
  assert(!section || (checklist.section === section && catalog.services.find(service => service.id === route).sections.some(part => part.id === section)), `Unknown checklist section: ${id}`);
  assert.equal(new Set(checklist.items.map(([key]) => key)).size, checklist.items.length, `Duplicate checklist item: ${id}`);
  assert(Object.hasOwn(catalog.sources, checklist.source), `Unknown checklist source: ${checklist.source}`);
}

for (const contact of [...catalog.contacts, ...catalog.localContacts]) {
  assert(Object.hasOwn(catalog.sources, contact.source));
  assert.match(contact.dial, /^tel:\+?\d+$/);
}
for (const source of Object.values(catalog.sources)) {
  assert.equal(source.length, 3, `Incomplete source: ${source[0]}`);
  const [, url] = source;
  assert.equal(new URL(url).protocol, 'https:', `Invalid official source: ${url}`);
}

const file = join(__dirname, '../src/data/catalog.json');
const revision = createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
const snapshot = `${JSON.stringify({...catalog, revision}, null, 2)}\n`;
if (process.argv.includes('--check')) {
  assert(readFileSync(file, 'utf8') === snapshot, 'Run npm run sync:catalog to update the mobile catalog');
} else {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, snapshot);
}
