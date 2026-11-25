import { type AudioStreamBuffer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioStream } from 'expo-audio';
import { File } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState } from 'react-native';

import { speechThreshold, voiceInputLevel } from './assistant-voice-level';
import { motion, useReducedMotion } from './guide-motion';

const NativeWebSocket = WebSocket as typeof WebSocket & {
  new (url: string, protocols: null, options: { headers: Record<string, string> }): WebSocket;
};

type Phase = 'idle' | 'permission' | 'recording' | 'stopping' | 'recorded' | 'transcribing' | 'connecting' | 'listening' | 'confirming' | 'thinking' | 'speaking';
type Live = {
  socket: WebSocket;
  capturing: boolean;
  muted: boolean;
  awaiting: boolean;
  confirmation: string | null;
  lead: Int16Array[];
  spokenMs: number;
  turnMs: number;
  quietMs: number;
  timer: ReturnType<typeof setTimeout>;
  keepalive?: ReturnType<typeof setInterval>;
};

export function useAssistantAudio({ endpoint, token, active, onDraft, onQuestion, liveVoice }: {
  endpoint?: string;
  token: string;
  active: boolean;
  onDraft: (text: string) => void;
  onQuestion: (text: string) => Promise<string | undefined>;
  liveVoice?: string;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [liveOpen, setLiveOpen] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [inputLevel] = useState(() => new Animated.Value(0));
  const [replyPulse] = useState(() => new Animated.Value(0));
  const meter = useRef({ updatedAt: 0, level: 0 });
  const reduced = useReducedMotion();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [deviceVoice, setVoice] = useState<string>();
  const voice = liveVoice ?? deviceVoice;
  const operation = useRef<AbortController | null>(null);
  const live = useRef<Live | null>(null);
  const capturePending = useRef(false);
  const speech = useRef(0);
  const playing = useRef(false);
  const speechStartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recordState = useRef<'preparing' | 'recording' | 'recorded' | 'finishing' | null>(null);
  const { stream } = useAudioStream({ sampleRate: 24000, channels: 1, encoding: 'int16', onBuffer });

  useEffect(() => {
    if (!active || liveVoice) return;
    let current = true;
    void Speech.getAvailableVoicesAsync().then(voices => {
      if (current) setVoice(voices.find(item => /^uk(?:[-_]|$)/i.test(item.language))?.identifier);
    }).catch(() => {});
    return () => { current = false; };
  }, [active, liveVoice]);

  function stopSpeech() {
    speech.current++;
    clearTimeout(speechStartTimer.current);
    playing.current = false;
    replyPulse.setValue(0);
    void Speech.stop().catch(() => {});
    if (live.current) setPhase('listening');
  }

  function speak(text: string) {
    if (!voice) {
      setError('На цьому пристрої немає українського голосу. Відповідь доступна в чаті.');
      return;
    }
    const id = ++speech.current;
    clearTimeout(speechStartTimer.current);
    playing.current = true;
    const done = () => {
      if (id !== speech.current) return;
      clearTimeout(speechStartTimer.current);
      playing.current = false;
      replyPulse.setValue(0);
      if (live.current) setPhase('listening');
    };
    const failed = () => {
      if (id !== speech.current) return;
      stopSpeech();
      setError('Не вдалося відтворити відповідь. Вона доступна в чаті.');
    };
    const pulse = () => {
      if (id !== speech.current || !live.current || reduced) return;
      Animated.sequence([
        Animated.timing(replyPulse, { toValue: 1, duration: 70, easing: motion.easeOut, useNativeDriver: true, isInteraction: false }),
        Animated.timing(replyPulse, { toValue: 0, duration: 200, easing: motion.easeOut, useNativeDriver: true, isInteraction: false }),
      ]).start();
    };
    void Speech.stop().then(() => {
      if (id !== speech.current) return;
      Speech.speak(text, {
        language: 'uk-UA', voice, rate: 0.95, useApplicationAudioSession: true,
        onStart: () => {
          if (id !== speech.current) return;
          clearTimeout(speechStartTimer.current);
          if (live.current) setPhase('speaking');
          pulse();
        },
        onBoundary: pulse,
        onDone: done, onStopped: done,
        onError: failed,
      });
    }).catch(failed);
    speechStartTimer.current = setTimeout(failed, 5000);
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
    clearInterval(session.keepalive);
    session.socket.close();
    try { stream.stop(); } catch { /* The audio device may already be closed. */ }
    stopSpeech();
    resetInputLevel();
    setMicMuted(false);
    setPhase('idle');
    setConfirmation('');
    setLiveOpen(false);
    setError(nextError);
  }

  function cancel() {
    operation.current?.abort();
    clearTimeout(recordingTimer.current);
    if (recordState.current === 'recording' || recordState.current === 'recorded') void finishRecording('discard');
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
      recordingTimer.current = setTimeout(() => void finishRecording('keep'), 60_000);
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

  async function finishRecording(action: 'keep' | 'transcribe' | 'discard') {
    const controller = operation.current;
    const state = recordState.current;
    if (!controller || (state !== 'recording' && state !== 'recorded')) return;
    recordState.current = 'finishing';
    clearTimeout(recordingTimer.current);
    const upload = action === 'transcribe';
    if (action !== 'discard') setPhase(upload ? 'transcribing' : 'stopping');
    const timeout = upload ? setTimeout(() => controller.abort('timeout'), 22000) : undefined;
    let keep = false;
    try {
      if (state === 'recording') await recorder.stop();
      if (action === 'discard' || controller.signal.aborted) return;
      if (!recorder.uri) throw new Error();
      if (!upload) {
        keep = true;
        return;
      }
      const bytes = await new File(recorder.uri).arrayBuffer();
      if (controller.signal.aborted) return;
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
        setError(upload ? 'Не вдалося розпізнати запис. Спробуйте ще раз або напишіть запитання.' : 'Не вдалося завершити запис.');
      }
    } finally {
      clearTimeout(timeout);
      if (state === 'recording') await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (keep && !controller.signal.aborted) {
        recordState.current = 'recorded';
        setPhase('recorded');
      } else {
        discardRecording();
        operation.current = null;
        recordState.current = null;
        setPhase('idle');
      }
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
    try {
      if (!await askPermission(controller)) return;
      setLiveOpen(true);
      setPhase('connecting');
      const socket = new NativeWebSocket(endpoint.replace(/^http/, 'ws') + '/live', null, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const session: Live = {
        socket, capturing: false, muted: false, awaiting: false, confirmation: null,
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
            session.keepalive = setInterval(() => {
              if (socket.readyState === WebSocket.OPEN) socket.send('keepalive');
            }, 20_000);
            await startCapture(session);
            if (live.current !== session) return;
            setPhase('listening');
          } else if (event.type === 'transcript' && session.awaiting) {
            const text = typeof event.text === 'string' ? event.text.trim() : '';
            if (text.length > 500) {
              onDraft(text);
              closeLive('Запитання задовге. Скоротіть його в чаті.');
            } else if (text && /[0-9]|(?:^|[^\p{L}])(?:не|ні|убд|сзч|влк|екопфо|мсек|тисяч\p{L}*|грив\p{L}*|строк\p{L}*|термін\p{L}*|днів|день|місяц\p{L}*)(?=$|[^\p{L}])/iu.test(text)) {
              session.confirmation = text;
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
      if (answer) speak(answer);
    } else {
      setError('Не вдалося розібрати фразу. Скажіть її ще раз.');
    }
    session.awaiting = false;
    if (!playing.current) setPhase('listening');
  }

  function confirmTranscript(edit: boolean) {
    if (phase !== 'confirming') return;
    const session = live.current;
    if (!session?.confirmation) return;
    const text = session.confirmation;
    session.confirmation = null;
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
    resetInputLevel();
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
    if (!session || !session.capturing || session.awaiting || capturePending.current || session.socket.readyState !== WebSocket.OPEN) return;
    session.muted = !session.muted;
    try {
      if (session.muted) {
        stream.stop();
        session.socket.send('clear');
        resetInputLevel();
      } else {
        await startCapture(session);
      }
      if (live.current !== session) return;
      session.turnMs = session.quietMs = session.spokenMs = 0;
      session.lead = [];
      setMicMuted(session.muted);
    } catch {
      if (live.current === session) closeLive('Не вдалося перемкнути мікрофон. Можна продовжити в чаті.');
    }
  }

  function resetInputLevel() {
    meter.current = { updatedAt: 0, level: 0 };
    inputLevel.setValue(0);
  }

  function showInput(rms: number) {
    if (reduced) return;
    const now = performance.now();
    if (now - meter.current.updatedAt < 50) return;
    const level = voiceInputLevel(rms);
    if (Math.abs(level - meter.current.level) < 0.025 && !(level === 0 && meter.current.level > 0)) return;
    const duration = level > meter.current.level ? 75 : 145;
    meter.current = { updatedAt: now, level };
    Animated.timing(inputLevel, { toValue: level, duration, easing: motion.easeOut, useNativeDriver: true, isInteraction: false }).start();
  }

  function onBuffer({ data, sampleRate, channels }: AudioStreamBuffer) {
    const session = live.current;
    if (!session || session.muted || session.awaiting || session.socket.readyState !== WebSocket.OPEN) return;
    const input = new Int16Array(data);
    if (!input.length || !sampleRate || !channels) return;
    const samples = sampleRate === 24000 && channels === 1 ? input :
      Int16Array.from({ length: Math.floor(input.length * 24000 / channels / sampleRate) }, (_, index) =>
        input[Math.floor(index * sampleRate / 24000) * channels]);
    if (!samples.length) return;
    const ms = samples.length / 24;
    const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length) / 32768;
    // shortcut: fixed speech thresholds for Dev devices, calibrate against real calls before wider rollout.
    const speaking = rms > (playing.current ? 0.055 : speechThreshold);
    if (!playing.current) showInput(rms);
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
    phase, error, voice, liveOpen, micMuted, inputLevel, replyPulse, confirmation, confirmTranscript, recorder,
    startRecording, finishRecording, startLive, cancel, toggleMic, speak, stopSpeech,
  };
}
