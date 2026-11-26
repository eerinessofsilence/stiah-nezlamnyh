const assert = require('node:assert/strict');
const test = require('node:test');
const { services, preparation, sources, contacts, localContacts, featured } = require('../src/data/catalog.json');
const { readProfile, statuses } = require('../src/guide-profile.ts');
const { answerSections, findContacts, findSections, findServices, localAnswers, localCatalogReply, matchTopics, parseAiAnswers, parseCatalogReply } = require('../src/search.js');

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

test('assistant opens verified definitions and continues into the relevant guide section', () => {
  const ubd = {route: 'status', section: 'ubd-meaning'};
  const szch = {route: 'legal', section: 'szch-meaning'};
  assert.deepEqual(localAnswers(services, 'А ну, розкажи, що таке взагалі УБД?'), [ubd]);
  assert.deepEqual(localAnswers(services, 'Что такое с-з-ч?'), [szch]);
  assert.deepEqual(localAnswers(services, 'СЗЧ?', ubd), [szch]);
  assert.deepEqual(localAnswers(services, 'Що означає ВЛК?'), [{route: 'vlk', section: 'vlk-meaning'}]);
  assert.deepEqual(localAnswers(services, 'Що таке ЕКОПФО?'), [{route: 'msek', section: 'assessment-meaning'}]);
  assert.deepEqual(localAnswers(services, 'А можна докладніше?', ubd), [{route: 'status', section: 'ubd'}]);
  assert.deepEqual(localAnswers(services, 'Можешь рассказать чуть подробнее об этом?', szch), [{route: 'legal', section: 'szch-record'}]);
  assert.deepEqual(localAnswers(services, 'Які документи потрібні для УБД?', szch), [{route: 'status', section: 'ubd'}]);
  assert.deepEqual(localAnswers(services, 'Що таке їжакоптер?', ubd), []);
  assert.equal(findServices(services, 'СЗЧ')[0].id, 'legal');
});

test('offline search distinguishes loss of a limb, an item and a person', () => {
  const start = {route: 'rehab', section: 'after-amputation'};
  for (const question of ['я потерял ногу', 'Мой муж остался без ноги', 'Мені ампутували обидві ноги',
    'Я втратила праву руку. З чого почати?', 'Після ампутації, що далі?']) {
    assert.deepEqual(localCatalogReply(services, question, {route: 'fallen-family', section: null}).answers, [start], question);
  }
  for (const question of ['я потерял', 'я потерял паспорт', 'я потерял собаку', 'я не потерял ногу', 'потерял чувствительность в ноге']) {
    assert.deepEqual(localCatalogReply(services, question).answers, [], question);
  }
  assert.equal(localAnswers(services, 'Мы потеряли кормильца')[0].route, 'fallen-family');
  assert.deepEqual(localAnswers(services, 'Я потеряла ногу. Как починить протез?'), [{route: 'rehab', section: 'repair'}]);
  const evidence = {...start, paragraphs: [2]};
  assert.deepEqual(parseAiAnswers(services, [evidence]), [evidence]);
  for (const paragraphs of [[0], [999], ['2'], [2, 2]]) assert.throws(() => parseAiAnswers(services, [{...start, paragraphs}]));
});

test('assistant handles overviews, follow-ups and distinct parts of a request offline', () => {
  const sport = { route: 'veteran-sports', section: null };
  const training = { ...sport, section: 'training' };
  const ubd = { route: 'status', section: 'ubd' };
  assert.deepEqual(localCatalogReply(services, 'Що є в розділі «Ветеранський спорт»?'), { answers: [sport], mode: 'answer' });
  assert.deepEqual(localCatalogReply(services, 'А в Одессе?', sport), { answers: [training], mode: 'answer' });
  assert.deepEqual(localCatalogReply(services, 'В Одесі.', sport), { answers: [training], mode: 'answer' });
  assert.deepEqual(localCatalogReply(services, 'А как записаться?', training), { answers: [training], mode: 'answer' });
  assert.deepEqual(localCatalogReply(services, 'А что с выплатой?', sport), {
    answers: [{ ...sport, section: 'payment' }], mode: 'answer'
  });
  assert.deepEqual(localCatalogReply(services, 'А можна докладніше?', sport), {
    answers: [training, { ...sport, section: 'payment' }], mode: 'clarify'
  });
  assert.deepEqual(localCatalogReply(services, 'Які документи потрібні для УБД і де знайти адаптивні тренування?'), {
    answers: [ubd, training], mode: 'answer'
  });
  assert.deepEqual(localCatalogReply(services, 'Які документи потрібні для УБД і яка температура на Марсі?'), {
    answers: [ubd], mode: 'partial'
  });
  assert.deepEqual(localCatalogReply(services, 'Что такое УБД. Что такое СЗЧ.'), {
    answers: [{ route: 'status', section: 'ubd-meaning' }, { route: 'legal', section: 'szch-meaning' }], mode: 'answer'
  });
  assert.throws(() => parseCatalogReply(services, { answers: [training], mode: 'clarify' }));
  assert.throws(() => parseCatalogReply(services, { answers: [{ ...sport, section: 'unknown' }], mode: 'answer' }));
});

test('offline answers distinguish background, specific catalogue topics and requests for guarantees', () => {
  const sports = { route: 'veteran-sports', section: 'training' };
  for (const [question, route, section] of [
    ['Я вже звільнився зі служби. Як отримати УБД самостійно?', 'status', 'discharged'],
    ['Після повернення не можу заснути, до кого звернутися?', 'psychology', 'start'],
    ['Гільза бовтається, де її поміняти?', 'rehab', 'repair'],
    ['Де оформити допомогу на поховання загиблого військового?', 'fallen-family', 'burial'],
    ['Які документи подати для пенсії в разі втрати годувальника?', 'fallen-family', 'pension-application'],
    ['Экспертная команда — это что?', 'msek', 'assessment-meaning'],
    ['Що робити, якщо в Дії зник документ ветерана?', 'status', 'digital-id'],
  ]) {
    assert.deepEqual(localCatalogReply(services, question), { answers: [{route, section}], mode: 'answer' }, question);
  }
  for (const question of ['Гарантуй, що мені дадуть компенсацію за житло.', 'А коли вони мені подзвонять?']) {
    assert.deepEqual(localCatalogReply(services, question, sports), { answers: [], mode: 'answer' }, question);
  }
});

test('prescription medicine queries open the same topic in catalog search and offline answers', () => {
  const section = 'prescription-medicine';
  for (const question of ['безкоштовні ліки', 'ліки за рецептом', 'пільговий рецепт', 'Доступні ліки', 'безкоштовні ліки для УБД', 'пільга на лікарські засоби', 'льготный рецепт на лекарства']) {
    const route = findServices(services, question)[0];
    assert.equal(route?.id, 'medical', question);
    assert.deepEqual(answerSections(route, question).map(item => item.id), [section], question);
    assert.deepEqual(localAnswers(services, question), [{route: 'medical', section}], question);
  }
  const medical = services.find(service => service.id === 'medical');
  assert.equal(findSections(medical.sections, 'пільговий рецепт')[0]?.id, section);
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

test('family profiles and active military lead to the relevant offline guidance', () => {
  for (const [id, sectionCount] of [['missing-family', 16], ['pow-family', 7], ['fallen-family', 27]]) {
    const status = statuses.find(status => status.id === id);
    assert.deepEqual(status.serviceIds, [id]);
    assert.equal(status.showSections, true);
    const { sections } = services.find(service => service.id === id);
    const topics = findSections(sections, '');
    assert.equal(topics.length, sectionCount);
    assert.equal(new Set(topics.map(topic => topic.id)).size, sectionCount);
    assert(topics.every(topic => topic.title && topic.paragraphs.length > 0));
  }
  assert(statuses.find(status => status.id === 'military').serviceIds.includes('msek'));

  for (const [question, route, section] of [
    ['впізнали на відео', 'missing-family', 'recognition'],
    ['Чи дають пенсію якщо військовий зник безвісти?', 'missing-family', 'missing-pension'],
    ['як підтвердити полон', 'pow-family', 'confirm-captivity'],
    ['відстрочка через полон', 'pow-family', 'deferral'],
    ['15 млн за загибель у полоні', 'pow-family', 'death-grant'],
    ['частина не надає акт', 'fallen-family', 'family-service-records'],
    ['немає доступу до тіла військового', 'fallen-family', 'death-without-body'],
    ['ЕКПФО у відпустці', 'msek', 'military-referral'],
    ['ВЛК визнала придатним, є інвалідність', 'msek', 'disability-discharge'],
  ]) {
    const first = findServices(services, question)[0];
    assert.equal(first?.id, route, question);
    assert.deepEqual(answerSections(first, question).map(item => item.id), [section], question);
    assert.deepEqual(localAnswers(services, question), [{route, section}], question);
  }
});

test('family topic search finds instructions within the selected guide', () => {
  for (const [id, query, expected] of [
    ['missing-family', 'ЄРДР', 'search'],
    ['pow-family', 'підтвердити полон', 'confirm-captivity'],
    ['fallen-family', 'поховання', 'burial'],
  ]) {
    const { sections } = services.find(service => service.id === id);
    const results = findSections(sections, query);
    assert.equal(results[0]?.id, expected);
    assert(results.length < sections.length);
    assert.deepEqual(findSections(sections, 'їжакоптер'), []);
  }
  for (const [key, section] of [
    ['missing-family', 'search-documents'], ['pow-family', 'confirm-captivity'],
    ['fallen-family', 'family-status'], ['fallen-family:death-grant', 'death-grant'],
  ]) {
    assert.equal(preparation[key].section, section);
  }
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

test('all four contact cards point to an official source and a dialable number', () => {
  assert.equal(contacts.length, 4);
  assert.equal(contacts[0].source, 'hotline');
  for (const contact of [...contacts, ...localContacts]) {
    assert(Object.hasOwn(sources, contact.source));
    assert.match(contact.dial, /^tel:\+?\d+$/);
  }
});
