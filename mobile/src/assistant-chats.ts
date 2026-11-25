import type { CatalogReply } from './search';

export type Turn = { id: number; question: string; fallback?: string } & Partial<CatalogReply>;

export type AssistantChat = {
  id: number;
  title: string;
  pinned: boolean;
  turns: Turn[];
  question: string;
  voiceDraft: boolean;
};

export type AssistantChatSession = { chats: AssistantChat[]; activeId: number };

export const chatTitleLimit = 80;

export function newAssistantChat(id: number): AssistantChat {
  return { id, title: '', pinned: false, turns: [], question: '', voiceDraft: false };
}

export function hasChatContent(chat: AssistantChat) {
  return chat.turns.length > 0 || chat.question.trim().length > 0 || chat.title !== '' || chat.pinned;
}

export function assistantChatTitle(chat: AssistantChat) {
  const firstQuestion = chat.turns[0]?.question;
  if (chat.title) return chat.title;
  if (!firstQuestion) return 'Чернетка';
  return firstQuestion.length > chatTitleLimit ? firstQuestion.slice(0, chatTitleLimit - 1).trimEnd() + '…' : firstQuestion;
}

export function listAssistantChats(chats: AssistantChat[]) {
  return chats.filter(hasChatContent).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id);
}

export function removeAssistantChat(session: AssistantChatSession, id: number, createChat: () => AssistantChat): AssistantChatSession {
  const chats = session.chats.filter(chat => chat.id !== id);
  if (session.activeId !== id) return { ...session, chats };
  const next = listAssistantChats(chats)[0];
  if (next) return { chats, activeId: next.id };
  const blank = createChat();
  return { chats: [blank], activeId: blank.id };
}

export type ChatMenuBounds = { left: number; top: number; right: number; bottom: number };

export function chatMenuPosition(anchor: ChatMenuBounds, bounds: ChatMenuBounds, height: number) {
  const width = Math.min(256, Math.max(0, bounds.right - bounds.left));
  const maxHeight = Math.max(0, bounds.bottom - bounds.top);
  const left = Math.max(bounds.left, Math.min(anchor.right - width, bounds.right - width));
  const below = anchor.bottom + 4;
  const above = anchor.top - 4;
  const menuHeight = Math.min(height, maxHeight);
  const preferred = below + menuHeight <= bounds.bottom || bounds.bottom - below >= above - bounds.top
    ? below : above - menuHeight;
  const top = Math.max(bounds.top, Math.min(preferred, bounds.bottom - menuHeight));
  return { left, top, width, maxHeight };
}
