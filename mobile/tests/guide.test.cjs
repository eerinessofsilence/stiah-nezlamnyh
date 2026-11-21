const assert = require('node:assert/strict');
const test = require('node:test');
const { services, preparation, sources, contacts, localContacts, featured } = require('../src/data/catalog.json');
const { readProfile, statuses } = require('../src/guide-profile.ts');
const { findContacts, findServices, localAnswers, matchTopics, parseAiAnswers, routeProgressSummary } = require('../src/search.js');
const { readProgress, toggleProgress } = require('../src/route-progress.ts');

test('onboarding restores local profiles and preserves a previously selected status', () => {
  const profile = { name: 'Олена', statusId: 'veteran' };
  assert.equal(readProfile(null, null), null);
  assert.equal(readProfile(null, 'unknown'), null);
  assert.deepEqual(readProfile(null, 'military'), { name: '', statusId: 'military' });
  assert.deepEqual(readProfile(JSON.stringify(profile), 'military'), profile);
  assert.deepEqual(readProfile('{', 'military'), { name: '', statusId: 'military' });
  assert.equal(readProfile('{"name":"Олена","statusId":"unknown"}', null), null);
});

test('catalog search accepts short acronyms, punctuation and Ukrainian apostrophes', () => {
  assert.equal(findServices(services, 'М')[0].id, 'medical');
  assert.equal(findServices(services, 'ме')[0].id, 'medical');
  assert.equal(findServices(services, '  УБД? ')[0].id, 'status');
  assert.equal(findServices(services, 'Дія')[0].id, 'status');
  assert.equal(findServices(services, 'БПД')[0].id, 'legal');
  assert.equal(findServices(services, 'карʼєра')[0].id, 'work');
  assert.equal(findServices(services, 'протезування')[0].id, 'rehab');
  assert.deepEqual(findServices(services, 'їжакоптер'), []);
  assert.deepEqual(findServices(services, 'abc'), []);
  assert.equal(findServices(services, '').length, services.length);
});

test('assistant handles Ukrainian, Russian, contextual follow-ups, disambiguation and no match', () => {
  assert.deepEqual(matchTopics(services, 'Як оформити посвідчення ветерана?'), ['status']);
  assert.deepEqual(matchTopics(services, 'Куди звернутися щодо протезування?'), ['rehab']);
  assert.deepEqual(matchTopics(services, 'Які пільги й виплати доступні ветеранам?'), ['benefits']);
  assert.deepEqual(matchTopics(services, 'Где пройти протезирование?'), ['rehab']);
  assert.deepEqual(matchTopics(services, 'А які документи?', 'rehab'), ['rehab']);
  assert.deepEqual(new Set(matchTopics(services, 'Протези і пільги')), new Set(['rehab', 'benefits']));
  assert.deepEqual(matchTopics(services, 'їжакоптер'), []);
});

test('the four new guides are findable in search and assistant and include local checklists', () => {
  const routes = [
    ['Сімʼї загиблих', 'fallen-family'],
    ['Сім’ї безвісти зниклих', 'missing-family'],
    ['ВЛК', 'vlk'],
    ['МСЕК', 'msek'],
  ];
  for (const [query, id] of routes) {
    const route = findServices(services, query)[0];
    assert.equal(route.id, id);
    assert.equal(matchTopics(services, query)[0], id);
    assert.equal(preparation[id].items.length, 4);
    assert(route.sections.length >= 2);
    assert(route.source.every(key => Object.hasOwn(sources, key)));
  }
});

test('assistant distinguishes related commissions and gives the applicable first step', () => {
  assert.deepEqual(matchTopics(services, 'Як потрапити на ВЛК та які документи?'), ['vlk']);
  assert.deepEqual(matchTopics(services, 'Як потрапити на МСЕК та які документи?'), ['msek']);
  assert.deepEqual(matchTopics(services, 'Які виплати сімʼям загиблих?'), ['fallen-family']);
  assert.deepEqual(matchTopics(services, 'Як оформити виплати сімʼям загиблих?'), ['fallen-family']);
  assert.deepEqual(matchTopics(services, 'Як оскаржити висновок ВЛК?'), ['vlk']);
  assert.deepEqual(matchTopics(services, 'Які документи для ВЛК і МСЕК?'), ['vlk', 'msek']);
  assert.equal(findServices(services, 'Які документи для ВЛК?')[0].id, 'vlk');

});

test('assistant returns the applicable answer, not a generic first step', () => {
  for (const [question, route, section, expected] of [
    ['Які документи потрібні для УБД?', 'status', 'ubd', /довідку про безпосередню участь/u],
    ['Я вже звільнився. Як отримати УБД самостійно?', 'status', 'discharged', /ТЦК та СП/u],
    ['Де безоплатно полікувати зуби в Одесі?', 'medical', 'dental', /16-77/u],
    ['Чи потрібна інвалідність для протеза?', 'rehab', 'first-prosthesis', /не потрібно чекати/u],
    ['Як відремонтувати протез?', 'rehab', 'repair', /підприємства/u],
    ['Мені не спиться після повернення зі служби', 'psychology', 'start', /безоплатну психологічну/u],
    ['У мене УБД. Яка знижка на комуналку?', 'benefits', 'utilities', /75%/u],
    ['Скільки часу розглядають заяву на пільгу?', 'benefits', 'processing', /10 календарних днів/u],
    ['Як оскаржити рішення ВЛК?', 'vlk', 'appeal', /30-денний/u],
    ['Як оскаржити рішення експертної команди?', 'msek', 'appeal', /40 календарних днів/u],
    ['Де знайти фахівця із супроводу в Ізмаїлі?', 'escort', 'appointment', /громаду/u],
    ['Що робити після поранення?', 'injury', 'documents', /військова частина/u],
    ['Як отримати житлову компенсацію?', 'housing', 'compensation', /719/u],
    ['Скільки є часу подати на одноразову допомогу після загибелі?', 'fallen-family', 'death-grant', /три роки/u],
  ]) {
    assert.deepEqual(localAnswers(services, question), [{route, section}], question);
    assert.match(services.find(item => item.id === route).sections.find(item => item.id === section).paragraphs.join(' '), expected);
  }
  assert.deepEqual(localAnswers(services, 'А скільки чекати на рішення після подачі?', {route: 'benefits', section: 'utilities'}),
    [{route: 'benefits', section: 'processing'}]);
  assert.deepEqual(localAnswers(services, 'Гільза протеза розхиталась. Куди звернутися, щоб її замінили?'),
    [{route: 'rehab', section: 'repair'}]);
  assert.deepEqual(localAnswers(services, 'Звільнився зі служби і так і не оформив учасника бойових дій. Куди тепер нести документи?'),
    [{route: 'status', section: 'discharged'}]);
  const previous = {route: 'rehab', section: 'first-prosthesis'};
  assert.deepEqual(localAnswers(services, 'А які документи?', previous), [previous]);
  assert.deepEqual(localAnswers(services, 'їжакоптер'), []);
  assert.deepEqual(parseAiAnswers(services, [previous]), [previous]);
  assert.throws(() => parseAiAnswers(services, [{route: 'rehab', section: 'unknown'}]));
  assert.throws(() => parseAiAnswers(services, [null]));
});

test('urgent scenarios, colloquial search and local contacts are discoverable', () => {
  for (const route of ['injury', 'psychology', 'missing-family', 'escort']) assert(featured.includes(route));
  assert.equal(findServices(services, 'психолог')[0].id, 'psychology');
  assert.equal(findServices(services, 'поранення')[0].id, 'injury');
  assert.equal(findContacts(localContacts, 'Де фахівець в Ізмаїлі?')[0].source, 'izmailEscort');
  assert.equal(findContacts(localContacts, 'Ізма')[0].source, 'izmailEscort');
  assert.equal(findServices(services, 'крісло колісне')[0].id, 'rehab');
  assert.deepEqual(localAnswers(services, 'Як отримати крісло колісне?', {route: 'status', section: 'ubd'}),
    [{route: 'rehab', section: 'first-prosthesis'}]);
  assert(statuses.find(status => status.id === 'disability').serviceIds.includes('msek'));
  assert.equal(findContacts(localContacts, 'релевантного немає').length, 0);
});

test('progress round-trips with stable IDs and survives removing a bookmark', () => {
  const ids = new Set(services.map(({ id }) => id));
  const items = new Set(Object.entries(preparation).flatMap(([id, checklist]) => checklist.items.map(([key]) => `${id}:${key}`)));
  const empty = { saved: [], checked: [] };
  let progress = readProgress(null, ids, items);
  assert.deepEqual(progress, empty);
  progress = toggleProgress(progress, 'saved', 'rehab');
  progress = toggleProgress(progress, 'checked', 'rehab:identity');
  assert.deepEqual(readProgress(JSON.stringify(progress), ids, items), progress);
  progress = toggleProgress(progress, 'saved', 'rehab');
  assert.deepEqual(progress, { saved: [], checked: ['rehab:identity'] });
  assert.deepEqual(readProgress('{', ids, items), empty);
  const status = toggleProgress(empty, 'checked', 'status:ubd:application');
  assert.deepEqual(readProgress(JSON.stringify(status), ids, items), status);
  const summary = routeProgressSummary('status', preparation, status.checked);
  assert.equal(summary.section, 'ubd');
  assert.equal(summary.completed, 1);
  assert.equal(summary.total, 3);
  assert.deepEqual(readProgress('{"saved":["status","status","unknown",null],"checked":["status:unknown"]}', ids, items), {
    saved: ['status'], checked: [],
  });
});

test('all four contact cards point to an official source and a dialable number', () => {
  assert.equal(contacts.length, 4);
  assert.equal(contacts[0].source, 'hotline');
  for (const contact of [...contacts, ...localContacts]) {
    assert(Object.hasOwn(sources, contact.source));
    assert.match(contact.dial, /^tel:\+?\d+$/);
  }
});
