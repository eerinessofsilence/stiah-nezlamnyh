const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assistantShortReply, catalogOverview, replyPresentation } = require('../src/assistant-reply.ts');
const { services } = require('../src/data/catalog.json');

test('an overview uses complete lead paragraphs from the selected guide sections', () => {
  const sport = services.find(service => service.id === 'veteran-sports');
  const overview = catalogOverview(sport);
  assert.equal(overview.intro, sport.desc);
  assert.deepEqual(overview.topics, sport.sections);
  assert(overview.topics.every(topic => topic.source.length && topic.paragraphs[0]));
});

test('assistant acknowledges voice checks without swallowing a catalogue question', () => {
  const reply = 'Так, я на зв’язку. Чим можу допомогти?';
  for (const phrase of ['Ты меня слышишь?', 'Мене чути?', 'Алло, ти мене чуєш?', 'Алло-алло!']) {
    assert.equal(assistantShortReply(phrase), reply);
  }
  assert.equal(assistantShortReply('Алло, які документи потрібні для УБД?'), undefined);
  assert.equal(assistantShortReply('Ты меня слышишь? Где отремонтировать протез?'), undefined);
  assert.match(assistantShortReply('Как у тебя дела вообще?'), /знайти послугу в гіді/u);
  assert.equal(assistantShortReply('Як справи з моєю заявою?'), undefined);
});

test('assistant reveals a reply with one effect and respects the reader’s position', () => {
  assert.equal(replyPresentation(120, 100, 500, true, false), 'fade');
  assert.equal(replyPresentation(500, 100, 500, true, false), 'scroll');
  assert.equal(replyPresentation(80, 100, 500, true, false), 'scroll');
  assert.equal(replyPresentation(500, 100, 500, false, false), 'show');
  assert.equal(replyPresentation(120, 100, 500, true, true), 'show');
  assert.equal(replyPresentation(500, 100, 500, true, true), 'jump');
  assert.equal(replyPresentation(500, 100, 100, true, false), 'show');
});
