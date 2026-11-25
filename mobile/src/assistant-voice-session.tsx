import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useState } from 'react';

type VoiceSession = {
  endpoint: string;
  token: string;
  voice: string;
  onDraft: (text: string) => void;
  onQuestion: (text: string) => Promise<string | undefined>;
};

const VoiceSessionContext = createContext<VoiceSession | null>(null);
const SetVoiceSessionContext = createContext<Dispatch<SetStateAction<VoiceSession | null>>>(() => {});

export function AssistantVoiceProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<VoiceSession | null>(null);
  return (
    <SetVoiceSessionContext.Provider value={setSession}>
      <VoiceSessionContext.Provider value={session}>{children}</VoiceSessionContext.Provider>
    </SetVoiceSessionContext.Provider>
  );
}

export const useAssistantVoiceSession = () => useContext(VoiceSessionContext);
export const useSetAssistantVoiceSession = () => useContext(SetVoiceSessionContext);
