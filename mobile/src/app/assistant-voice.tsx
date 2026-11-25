import { Redirect, useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect, useRef } from 'react';

import { useAssistantAudio } from '../assistant-audio';
import { useAssistantVoiceSession, useSetAssistantVoiceSession } from '../assistant-voice-session';
import { AssistantVoiceView } from '../assistant-voice-view';
import { useGuideState } from '../guide-state';

export default function AssistantVoiceScreen() {
  const session = useAssistantVoiceSession();
  if (!session) return <Redirect href="/(tabs)/assistant" />;
  return <VoiceSessionScreen session={session} />;
}

function VoiceSessionScreen({ session }: { session: NonNullable<ReturnType<typeof useAssistantVoiceSession>> }) {
  const router = useRouter();
  const focused = useIsFocused();
  const { offline } = useGuideState();
  const setSession = useSetAssistantVoiceSession();
  const closing = useRef(false);
  const audio = useAssistantAudio({
    endpoint: session.endpoint, token: session.token, liveVoice: session.voice, active: focused && !offline,
    onQuestion: session.onQuestion,
    onDraft: text => { session.onDraft(text); end(); },
  });
  const started = useRef(false);
  const wasLive = useRef(false);
  useEffect(() => {
    if (!focused || offline || closing.current || started.current) return;
    started.current = true;
    void audio.startLive();
  }, [audio.startLive, focused, offline]);

  useEffect(() => () => setSession(current => current === session ? null : current), [session, setSession]);

  function end() {
    if (closing.current) return;
    closing.current = true;
    audio.cancel();
    router.dismissTo('/(tabs)/assistant');
  }
  useEffect(() => {
    if (wasLive.current && !audio.liveOpen && !audio.error) end();
    wasLive.current = audio.liveOpen;
  }, [audio.liveOpen, audio.error]);

  return <AssistantVoiceView audio={{ ...audio, cancel: end, error: offline ? 'Для голосової розмови потрібен інтернет.' : audio.error }} />;
}
