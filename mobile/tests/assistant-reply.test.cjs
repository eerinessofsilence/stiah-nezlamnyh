const assert = require('node:assert/strict');
const { test } = require('node:test');
const { localConversation, catalogOverview, nextConversationText, replyPresentation } = require('../src/assistant-reply.ts');
const { services } = require('../src/data/catalog.json');

test('an overview uses complete lead paragraphs from the selected guide sections', () => {
  const sport = services.find(service => service.id === 'veteran-sports');
  const overview = catalogOverview(sport);
  assert.equal(overview.intro, sport.desc);
  assert.deepEqual(overview.topics, sport.sections);
  assert(overview.topics.every(topic => topic.source.length && topic.paragraphs[0]));
});

test('assistant acknowledges voice checks without swallowing a catalogue question', () => {
  const reply = 'available';
  for (const phrase of ['Ты меня слышишь?', 'Мене чути?', 'Алло, ти мене чуєш?', 'Алло-алло!']) {
    assert.equal(localConversation(phrase), reply);
  }
  assert.equal(localConversation('Алло, які документи потрібні для УБД?'), undefined);
  assert.equal(localConversation('Ты меня слышишь? Где отремонтировать протез?'), undefined);
  assert.equal(localConversation('Как у тебя дела вообще?'), 'about');
  assert.equal(localConversation('Як справи з моєю заявою?'), undefined);
});

test('assistant greets people offline and sends substantive questions through to the guide', () => {
  for (const phrase of ['Привет', 'Привіт!', 'Добрий день', 'Здравствуйте']) {
    assert.equal(localConversation(phrase), 'greeting');
  }
  assert.equal(localConversation('Привет, ты меня слышишь?'), 'available');
  assert.equal(localConversation('Привет, какие документы нужны для УБД?'), undefined);
  assert.equal(localConversation('Вітаю! Де відремонтувати протез?'), undefined);
});

test('assistant reveals a reply with one effect and respects the reader’s position', () => {
  assert.equal(replyPresentation(120, 100, 100, 500, true, false), 'fade');
  assert.equal(replyPresentation(450, 100, 100, 500, true, false), 'scroll');
  assert.equal(replyPresentation(500, 100, 100, 500, true, false), 'scroll');
  assert.equal(replyPresentation(80, 100, 100, 500, true, false), 'scroll');
  assert.equal(replyPresentation(500, 100, 100, 500, true, true), 'jump');
  assert.equal(replyPresentation(120, 100, 100, 500, true, true), 'show');
  assert.equal(replyPresentation(500, 100, 100, 500, false, false), 'show');
  assert.equal(replyPresentation(120, 100, 100, 100, true, false), 'show');
});

test('repeats of a conversational intent rotate through approved alternatives', () => {
  const initial = 'Вітаю! Чим можу допомогти?';
  const first = nextConversationText('greeting', initial);
  const second = nextConversationText('greeting', initial, first);
  const third = nextConversationText('greeting', initial, second);
  assert.equal(first, initial);
  assert.equal(new Set([first, second, third]).size, 3);
  assert.equal(nextConversationText('greeting', initial, third), first);
});
