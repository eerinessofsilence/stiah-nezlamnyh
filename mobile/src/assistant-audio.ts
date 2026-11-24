import { type AudioStreamBuffer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, useAudioStream } from 'expo-audio';
import { File } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const NativeWebSocket = WebSocket as typeof WebSocket & {
  new (url: string, protocols: null, options: { headers: Record<string, string> }): WebSocket;
};

type Phase = 'idle' | 'permission' | 'recording' | 'transcribing' | 'connecting' | 'listening' | 'confirming' | 'thinking' | 'speaking' | 'muted';
type Live = {
  socket: WebSocket;
  capturing: boolean;
  muted: boolean;
  awaiting: boolean;
  lead: Int16Array[];
  spokenMs: number;
  turnMs: number;
  quietMs: number;
  timer: ReturnType<typeof setTimeout>;
};

export function useAssistantAudio({ endpoint, token, active, onDraft, onQuestion }: {
  endpoint?: string;
  token: string;
  active: boolean;
  onDraft: (text: string) => void;
  onQuestion: (text: string) => Promise<string | undefined>;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [liveOpen, setLiveOpen] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recording = useAudioRecorderState(recorder, 250);
  const [voice, setVoice] = useState<string>();
  const operation = useRef<AbortController | null>(null);
  const live = useRef<Live | null>(null);
  const capturePending = useRef(false);
  const speech = useRef(0);
  const playing = useRef(false);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recordState = useRef<'preparing' | 'recording' | 'finishing' | null>(null);
  const { stream } = useAudioStream({ sampleRate: 24000, channels: 1, encoding: 'int16', onBuffer });

  useEffect(() => {
    if (!active) return;
    let current = true;
    void Speech.getAvailableVoicesAsync().then(voices => {
      if (current) setVoice(voices.find(item => /^uk(?:[-_]|$)/i.test(item.language))?.identifier);
    }).catch(() => {});
    return () => { current = false; };
  }, [active]);

  function stopSpeech() {
    speech.current++;
    playing.current = false;
    void Speech.stop().catch(() => {});
    const session = live.current;
    if (session) setPhase(session.muted ? 'muted' : 'listening');
  }

  function speak(text: string) {
    if (!voice) {
      setError('На цьому пристрої немає українського голосу. Відповідь доступна в чаті.');
      return;
    }
    const id = ++speech.current;
    playing.current = true;
    if (live.current) setPhase('speaking');
    const done = () => {
      if (id !== speech.current) return;
      playing.current = false;
      if (live.current) setPhase(live.current.muted ? 'muted' : 'listening');
    };
    void Speech.stop().then(() => {
      if (id !== speech.current) return;
      Speech.speak(text, {
        language: 'uk-UA', voice, rate: 0.95, useApplicationAudioSession: true,
        onDone: done, onStopped: done,
        onError: () => { if (id === speech.current) setError('Не вдалося відтворити відповідь.'); done(); },
      });
    }).catch(done);
  }

  function discardRecording() {
    const uri = recorder.uri;
    if (!uri) return;
    try { new File(uri).delete(); } catch { /* The temporary file may already be gone. */ }
  }

  function closeLive(nextError = '') {
    const session = live.current;
    if (!session) return;
    live.current = null;
    clearTimeout(session.timer);
    session.socket.close();
    try { stream.stop(); } catch { /* The audio device may already be closed. */ }
    stopSpeech();
    setPhase('idle');
    setConfirmation('');
    setLiveOpen(false);
    setError(nextError);
  }

  function cancel() {
    operation.current?.abort();
    clearTimeout(recordingTimer.current);
    if (recordState.current === 'recording') void finishRecording(false);
    closeLive();
    if (playing.current) stopSpeech();
    setLiveOpen(false);
    setPhase('idle');
  }

  useEffect(() => {
    if (!active) cancel();
  }, [active]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') cancel();
    });
    return () => { subscription.remove(); cancel(); };
  }, []);

  async function askPermission(controller: AbortController) {
    setError('');
    setPhase('permission');
    const permission = await requestRecordingPermissionsAsync();
    if (controller.signal.aborted) return false;
    if (!permission.granted) {
      setError('Дозвольте доступ до мікрофона в налаштуваннях або напишіть запитання.');
      return false;
    }
    return true;
  }

  async function startRecording() {
    if (!active || !endpoint || operation.current || live.current || capturePending.current) return;
    stopSpeech();
    const controller = new AbortController();
    operation.current = controller;
    recordState.current = 'preparing';
    try {
      if (!await askPermission(controller)) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: false });
      if (controller.signal.aborted) return;
      await recorder.prepareToRecordAsync();
      if (controller.signal.aborted) {
        await recorder.stop().catch(() => {});
        discardRecording();
        return;
      }
      recorder.record();
      recordState.current = 'recording';
      setPhase('recording');
      recordingTimer.current = setTimeout(() => void finishRecording(true), 60_000);
    } catch {
      if (!controller.signal.aborted) setError('Не вдалося почати запис.');
    } finally {
      if (recordState.current === 'preparing') {
        recordState.current = null;
        operation.current = null;
        setPhase('idle');
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    }
  }

  async function finishRecording(upload: boolean) {
    const controller = operation.current;
    if (!controller || recordState.current !== 'recording') return;
    recordState.current = 'finishing';
    clearTimeout(recordingTimer.current);
    if (upload) setPhase('transcribing');
    const timeout = setTimeout(() => controller.abort('timeout'), 22000);
    try {
      await recorder.stop();
      if (!upload || controller.signal.aborted) return;
      if (!recorder.uri) throw new Error();
      const bytes = await new File(recorder.uri).arrayBuffer();
      const response = await fetch(endpoint + '/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/mp4', ...(token && { Authorization: 'Bearer ' + token }) },
        body: bytes, signal: controller.signal,
      });
      if (!response.ok) throw new Error();
      const { text } = await response.json();
      if (typeof text !== 'string' || !text.trim()) throw new Error();
      if (!controller.signal.aborted) onDraft(text.trim());
    } catch {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') {
        setError('Не вдалося розпізнати запис. Спробуйте ще раз або напишіть запитання.');
      }
    } finally {
      clearTimeout(timeout);
      discardRecording();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      operation.current = null;
      recordState.current = null;
      setPhase('idle');
    }
  }

  async function startLive() {
    if (!active || !endpoint || operation.current || live.current || capturePending.current) return;
    stopSpeech();
    if (!voice) {
      setError('Для розмови потрібен український голос. Додайте його в налаштуваннях пристрою.');
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    setLiveOpen(true);
    try {
      if (!await askPermission(controller)) return;
      setPhase('connecting');
      const socket = new NativeWebSocket(endpoint.replace(/^http/, 'ws') + '/live', null, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const session: Live = {
        socket, capturing: false, muted: false, awaiting: false,
        lead: [], spokenMs: 0, turnMs: 0, quietMs: 0,
        timer: setTimeout(() => closeLive('Не вдалося підключитися. Можна продовжити в чаті.'), 12000),
      };
      live.current = session;
      socket.onmessage = async ({ data }) => {
        if (live.current !== session || typeof data !== 'string') return;
        try {
          const event = JSON.parse(data);
          if (event.type === 'ready') {
            clearTimeout(session.timer);
            session.timer = setTimeout(() => closeLive('Голосову сесію завершено.'), 5 * 60_000);
            await startCapture(session);
            if (live.current !== session) return;
            setPhase('listening');
          } else if (event.type === 'transcript' && session.awaiting) {
            const text = typeof event.text === 'string' ? event.text.trim() : '';
            if (text.length > 500) {
              onDraft(text);
              closeLive('Запитання задовге. Скоротіть його в чаті.');
            } else if (text && /[0-9]|(?:^|[^\p{L}])(?:не|ні|убд|влк|екопфо|мсек|тисяч\p{L}*|грив\p{L}*|строк\p{L}*|термін\p{L}*|днів|день|місяц\p{L}*)(?=$|[^\p{L}])/iu.test(text)) {
              setConfirmation(text);
              setPhase('confirming');
            } else {
              await answerLive(session, text);
            }
          }
        } catch {
          closeLive('Голосовий зв’язок перервано. Можна продовжити в чаті.');
        }
      };
      socket.onclose = ({ code }) => {
        if (live.current === session) closeLive(code === 1000
          ? 'Голосову сесію завершено. Можна продовжити в чаті.'
          : 'Голосовий зв’язок перервано. Можна продовжити в чаті.');
      };
      socket.onerror = () => {
        if (live.current === session) closeLive('Не вдалося підключитися. Можна продовжити в чаті.');
      };
    } catch {
      if (!controller.signal.aborted) setError('Не вдалося почати розмову.');
    } finally {
      operation.current = null;
      if (!live.current) {
        setLiveOpen(false);
        setPhase('idle');
      }
    }
  }

  async function answerLive(session: Live, text: string) {
    if (text) {
      setPhase('thinking');
      const answer = await onQuestion(text);
      if (live.current !== session) return;
      if (answer && !session.muted) speak(answer);
    } else {
      setError('Не вдалося розібрати фразу. Скажіть її ще раз.');
    }
    session.awaiting = false;
    if (!playing.current) setPhase(session.muted ? 'muted' : 'listening');
  }

  function confirmTranscript(edit: boolean) {
    if (phase !== 'confirming') return;
    const session = live.current;
    if (!session || !confirmation) return;
    const text = confirmation;
    setConfirmation('');
    if (edit) {
      onDraft(text);
      closeLive();
    } else {
      void answerLive(session, text).catch(() => closeLive('Не вдалося отримати відповідь. Можна продовжити в чаті.'));
    }
  }

  function commit() {
    const session = live.current;
    if (!session || session.muted || session.awaiting || session.turnMs < 100 || session.socket.readyState !== WebSocket.OPEN) return;
    session.awaiting = true;
    session.turnMs = session.quietMs = session.spokenMs = 0;
    session.lead = [];
    session.socket.send('commit');
    setPhase('transcribing');
    setError('');
  }

  async function startCapture(session: Live) {
    capturePending.current = true;
    try {
      await stream.start();
      if (live.current !== session) stream.stop();
      else session.capturing = true;
    } finally {
      capturePending.current = false;
    }
  }

  async function toggleMic() {
    const session = live.current;
    if (!session || !session.capturing || capturePending.current || session.socket.readyState !== WebSocket.OPEN) return;
    session.muted = !session.muted;
    if (session.muted) {
      stream.stop();
      if (!session.awaiting) session.socket.send('clear');
    } else {
      try { await startCapture(session); } catch { closeLive('Не вдалося знову ввімкнути мікрофон.'); return; }
      if (live.current !== session) return;
    }
    session.turnMs = session.quietMs = session.spokenMs = 0;
    session.lead = [];
    setPhase(session.muted ? 'muted' : playing.current ? 'speaking' : session.awaiting ? 'transcribing' : 'listening');
  }

  function onBuffer({ data, sampleRate, channels }: AudioStreamBuffer) {
    const session = live.current;
    if (!session || session.muted || session.awaiting || session.socket.readyState !== WebSocket.OPEN) return;
    const input = new Int16Array(data);
    if (!input.length || !sampleRate || !channels) return;
    const samples = sampleRate === 24000 && channels === 1 ? input :
      Int16Array.from({ length: Math.floor(input.length * 24000 / channels / sampleRate) }, (_, index) =>
        input[Math.floor(index * sampleRate / 24000) * channels]);
    const ms = samples.length / 24;
    const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length) / 32768;
    // shortcut: fixed speech thresholds for Dev devices, calibrate against real calls before wider rollout.
    const speaking = rms > (playing.current ? 0.055 : 0.018);
    if (!session.turnMs) {
      session.lead.push(samples);
      if (session.lead.length > 4) session.lead.shift();
      session.spokenMs = speaking ? session.spokenMs + ms : 0;
      if (session.spokenMs < (playing.current ? 240 : 100)) return;
      if (playing.current) stopSpeech();
      for (const frame of session.lead) {
        session.socket.send(frame);
        session.turnMs += frame.length / 24;
      }
      session.lead = [];
      return;
    }
    session.socket.send(samples);
    session.turnMs += ms;
    session.quietMs = speaking ? 0 : session.quietMs + ms;
    if (session.quietMs >= 800 || session.turnMs >= 59000) commit();
  }

  return {
    phase, error, voice, liveOpen, confirmation, confirmTranscript, seconds: Math.floor(recording.durationMillis / 1000),
    startRecording, finishRecording, startLive, closeLive, cancel, commit, toggleMic, speak, stopSpeech,
  };
}
