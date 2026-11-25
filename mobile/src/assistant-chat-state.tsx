import { createContext, type ReactNode, useContext, useRef, useState } from 'react';

import { type AssistantChat, type AssistantChatSession, hasChatContent, newAssistantChat, removeAssistantChat } from './assistant-chats';

function useChatSession() {
  const [session, setSession] = useState<AssistantChatSession>(() => ({ chats: [newAssistantChat(0)], activeId: 0 }));
  const current = useRef(session);
  const nextId = useRef(1);

  // A voice session can submit later through a callback created when the call started.
  function updateSession(next: AssistantChatSession) {
    current.current = next;
    setSession(next);
  }

  function getChat(id: number) {
    return current.current.chats.find(chat => chat.id === id);
  }

  function updateChat(id: number, update: (chat: AssistantChat) => AssistantChat) {
    const snapshot = current.current;
    if (!getChat(id)) return;
    updateSession({ ...snapshot, chats: snapshot.chats.map(chat => chat.id === id ? update(chat) : chat) });
  }

  function openChat(id: number) {
    const snapshot = current.current;
    if (snapshot.activeId === id || !getChat(id)) return;
    updateSession({ chats: snapshot.chats.filter(chat => chat.id !== snapshot.activeId || hasChatContent(chat)), activeId: id });
  }

  function startChat() {
    const snapshot = current.current;
    const active = getChat(snapshot.activeId);
    if (active && !hasChatContent(active)) return;
    const chat = newAssistantChat(nextId.current++);
    updateSession({ chats: [...snapshot.chats, chat], activeId: chat.id });
  }

  function deleteChat(id: number) {
    updateSession(removeAssistantChat(current.current, id, () => newAssistantChat(nextId.current++)));
  }

  return {
    ...session, getChat, getActiveId: () => current.current.activeId,
    updateChat, openChat, startChat, deleteChat,
  };
}

const AssistantChatContext = createContext<ReturnType<typeof useChatSession> | null>(null);

export function AssistantChatProvider({ children }: { children: ReactNode }) {
  const session = useChatSession();
  return <AssistantChatContext.Provider value={session}>{children}</AssistantChatContext.Provider>;
}

export function useAssistantChats() {
  const session = useContext(AssistantChatContext);
  if (!session) throw new Error('AssistantChatProvider is missing');
  return session;
}
