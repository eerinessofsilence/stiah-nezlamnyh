const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assistantChatTitle, chatMenuPosition, chatTitleLimit, listAssistantChats, newAssistantChat, removeAssistantChat } = require('../src/assistant-chats.ts');

test('history keeps drafts and named chats, with pinned chats first', () => {
  const blank = newAssistantChat(4);
  const draft = { ...newAssistantChat(3), question: 'Чернетка' };
  const longQuestion = 'а'.repeat(chatTitleLimit + 10);
  const pinned = { ...newAssistantChat(1), pinned: true, turns: [{ id: 0, question: longQuestion }] };
  const named = { ...newAssistantChat(2), title: 'Документи' };

  assert.deepEqual(listAssistantChats([pinned, named, draft, blank]), [pinned, draft, named]);
  assert.equal(assistantChatTitle(named), 'Документи');
  assert.equal(assistantChatTitle(draft), 'Чернетка');
  assert.equal(assistantChatTitle(pinned), 'а'.repeat(chatTitleLimit - 1) + '…');
});

test('deleting a chat preserves other drafts and selects a chat when the active one is removed', () => {
  const draft = { ...newAssistantChat(3), question: 'Чернетка' };
  const pinned = { ...newAssistantChat(1), pinned: true };
  const other = { ...newAssistantChat(2), title: 'Документи' };
  const createChat = () => newAssistantChat(4);
  const session = { chats: [pinned, other, draft], activeId: draft.id };

  assert.deepEqual(removeAssistantChat(session, other.id, createChat), { chats: [pinned, draft], activeId: draft.id });
  assert.deepEqual(removeAssistantChat(session, draft.id, createChat), { chats: [pinned, other], activeId: pinned.id });
  assert.deepEqual(removeAssistantChat({ chats: [draft], activeId: draft.id }, draft.id, createChat), { chats: [createChat()], activeId: 4 });
});

test('the chat menu stays next to its button and fits within the safe screen area', () => {
  const bounds = { left: 12, top: 60, right: 350, bottom: 720 };
  const anchor = { left: 292, top: 120, right: 336, bottom: 164 };
  assert.deepEqual(chatMenuPosition(anchor, bounds, 140), { left: 80, top: 168, width: 256, maxHeight: 660 });
  assert.equal(chatMenuPosition({ ...anchor, top: 650, bottom: 694 }, bounds, 140).top, 506);
  assert.deepEqual(chatMenuPosition(anchor, { ...bounds, right: 200, bottom: 260 }, 300),
    { left: 12, top: 60, width: 188, maxHeight: 200 });
});
