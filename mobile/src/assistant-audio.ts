import { type AudioPlayer, type AudioStreamBuffer, createAudioPlayer, IOSOutputFormat, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioStream } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Platform } from 'react-native';

import { acceptLiveSpeech, createLiveVoiceGate, type LiveVoiceGate, liveVoiceThreshold, voiceInputLevel } from './assistant-voice-level';
import { motion, useReducedMotion } from './guide-motion';
import { storeVoiceEndpoint } from './assistant-online';

const NativeWebSocket = WebSocket as typeof WebSocket & {
  new (url: string, protocols: null, options: { headers: Record<string, string> }): WebSocket;
};

type Phase = 'idle' | 'permission' | 'recording' | 'transcribing' | 'connecting' | 'listening' | 'thinking' | 'speaking';
const liveSamplesPerMs = 24;
const liveFrameSamples = 50 * liveSamplesPerMs;
const liveLeadSamples = 600 * liveSamplesPerMs;
const recordingOptions = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
const storeRecordingOptions = {
  ...recordingOptions,
  extension: '.wav', sampleRate: 16000, numberOfChannels: 1, bitRate: 256000,
  ios: { ...recordingOptions.ios, outputFormat: IOSOutputFormat.LINEARPCM },
};
type Live = {
  socket: WebSocket;
  capturing: boolean;
  muted: boolean;
  awaiting: boolean;
  lead: Int16Array[];
  voiceGate: LiveVoiceGate;
  turnMs: number;
  quietMs: number;
  timer: ReturnType<typeof setTimeout>;
  keepalive?: ReturnType<typeof setInterval>;
};

export function useAssistantAudio({ endpoint, token, active, playbackActive = active, serverSpeech = false, onDraft, onQuestion }: {
  endpoint?: string;
  token: string;
  active: boolean;
  playbackActive?: boolean;
  serverSpeech?: boolean;
  onDraft: (text: string) => void;
  onQuestion: (text: string) => Promise<string | undefined>;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [inputLevel] = useState(() => new Animated.Value(0));
  const [replyPulse] = useState(() => new Animated.Value(0));
  const meter = useRef({ updatedAt: 0, level: 0 });
  const reduced = useReducedMotion();
  const storeVoice = Boolean(endpoint && endpoint === storeVoiceEndpoint);
  const recorder = useAudioRecorder(storeVoice ? storeRecordingOptions : recordingOptions);
  const [voice, setVoice] = useState<string>();
  const operation = useRef<AbortController | null>(null);
  const live = useRef<Live | null>(null);
  const capturePending = useRef(false);
  const speech = useRef(0);
  const releasePlayback = useRef<() => void>(undefined);
  const playing = useRef(false);
  const speechStartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recordState = useRef<'preparing' | 'recording' | 'finishing' | null>(null);
  const { stream } = useAudioStream({ sampleRate: 24000, channels: 1, encoding: 'int16', onBuffer });

  useEffect(() => {
    if (!playbackActive) return;
    let current = true;
    void Speech.getAvailableVoicesAsync().then(voices => {
      if (current) setVoice(voices.find(item => /^uk(?:[-_]|$)/i.test(item.language))?.identifier);
    }).catch(() => {});
    return () => { current = false; };
  }, [playbackActive]);

  function stopSpeech() {
    speech.current++;
    clearTimeout(speechStartTimer.current);
    releasePlayback.current?.();
    releasePlayback.current = undefined;
    playing.current = false;
    setSpeaking(false);
    replyPulse.setValue(0);
    void Speech.stop().catch(() => {});
    if (live.current) setPhase('listening');
  }

  function speak(text: string, useServerSpeech = serverSpeech) {
    const id = ++speech.current;
    releasePlayback.current?.();
    releasePlayback.current = undefined;
    setError('');
    clearTimeout(speechStartTimer.current);
    playing.current = true;
    setSpeaking(true);
    const done = () => {
      if (id !== speech.current) return;
      clearTimeout(speechStartTimer.current);
      releasePlayback.current?.();
      releasePlayback.current = undefined;
      playing.current = false;
      setSpeaking(false);
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
    const started = () => {
      if (id !== speech.current) return;
      clearTimeout(speechStartTimer.current);
      if (live.current) setPhase('speaking');
      pulse();
    };
    function speakOnDevice() {
      if (id !== speech.current) return;
      if (!voice) {
        done();
        setError('На цьому пристрої немає українського голосу. Відповідь доступна в чаті.');
        return;
      }
      speechStartTimer.current = setTimeout(failed, 5000);
      Speech.speak(text, {
        language: 'uk-UA', voice, rate: 0.95, useApplicationAudioSession: true,
        onStart: started,
        onBoundary: pulse,
        onDone: done, onStopped: done,
        onError: failed,
      });
    }

    void Speech.stop().then(async () => {
      if (id !== speech.current) return;
      // The iOS live stream already owns a play-and-record session with echo cancellation.
      if (Platform.OS !== 'ios' || !live.current) {
        await setAudioModeAsync({ playsInSilentMode: true });
        if (id !== speech.current) return;
      }
      if (!useServerSpeech || !endpoint) return speakOnDevice();

      const controller = new AbortController();
      let file: File | undefined;
      let player: AudioPlayer | undefined;
      let subscription: ReturnType<AudioPlayer['addListener']> | undefined;
      const release = () => {
        controller.abort();
        subscription?.remove();
        player?.remove();
        if (file?.exists) {
          try { file.delete(); } catch { /* The cache file may already be gone. */ }
        }
      };
      releasePlayback.current = release;
      const fallback = () => {
        if (id !== speech.current || controller.signal.aborted) return;
        clearTimeout(speechStartTimer.current);
        release();
        releasePlayback.current = undefined;
        speakOnDevice();
      };
      speechStartTimer.current = setTimeout(fallback, 16000);
      try {
        const response = await fetch(endpoint + '/speech', {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) throw new Error();
        const mime = response.headers.get('Content-Type');
        if (mime !== 'audio/wav' && mime !== 'audio/mpeg') throw new Error();
        const extension = mime === 'audio/mpeg' ? 'mp3' : 'wav';
        const audio = await response.arrayBuffer();
        if (controller.signal.aborted) return;
        file = new File(Paths.cache, `assistant-reply-${Date.now()}-${id}.${extension}`);
        file.write(new Uint8Array(audio));
        player = createAudioPlayer(file.uri, { keepAudioSessionActive: Boolean(live.current), updateInterval: 300 });
        let hasStarted = false;
        subscription = player.addListener('playbackStatusUpdate', status => {
          if (controller.signal.aborted) return;
          if (status.didJustFinish) done();
          else if (status.playbackState === 'failed') {
            if (hasStarted) failed();
            else fallback();
          } else if (status.playing && status.currentTime > 0) {
            if (hasStarted) pulse();
            else {
              hasStarted = true;
              started();
            }
          }
        });
        player.play();
      } catch {
        fallback();
      }
    }).catch(failed);
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
    setError(nextError);
  }

  function cancel() {
    operation.current?.abort();
    clearTimeout(recordingTimer.current);
    if (recordState.current === 'recording') void finishRecording('discard');
    closeLive();
    if (playing.current) stopSpeech();
    setPhase('idle');
  }

  useEffect(() => {
    if (!active) cancel();
  }, [active]);

  useEffect(() => {
    if (!playbackActive && playing.current) stopSpeech();
  }, [playbackActive]);

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
      recordingTimer.current = setTimeout(() => void finishRecording('transcribe'), 60_000);
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

  async function finishRecording(action: 'transcribe' | 'discard') {
    const controller = operation.current;
    if (!controller || recordState.current !== 'recording') return;
    recordState.current = 'finishing';
    clearTimeout(recordingTimer.current);
    const upload = action === 'transcribe';
    if (upload) setPhase('transcribing');
    const timeout = upload ? setTimeout(() => controller.abort('timeout'), 22000) : undefined;
    try {
      await recorder.stop();
      if (!upload || controller.signal.aborted) return;
      if (!recorder.uri) throw new Error();
      const bytes = await new File(recorder.uri).arrayBuffer();
      if (controller.signal.aborted) return;
      const response = await fetch(endpoint + '/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': storeVoice ? 'audio/wav' : 'audio/mp4', ...(token && { Authorization: 'Bearer ' + token }) },
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
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      discardRecording();
      operation.current = null;
      recordState.current = null;
      setPhase('idle');
    }
  }

  async function startLive() {
    if (!active || !endpoint || operation.current || live.current || capturePending.current) return;
    stopSpeech();
    if (!voice && !serverSpeech) {
      setError('Для розмови потрібен український голос. Додайте його в налаштуваннях пристрою.');
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    try {
      if (!await askPermission(controller)) return;
      setPhase('connecting');
      const socket = new NativeWebSocket(endpoint.replace(/^http/, 'ws') + '/live', null, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      const session: Live = {
        socket, capturing: false, muted: false, awaiting: false,
        lead: [], voiceGate: createLiveVoiceGate(), turnMs: 0, quietMs: 0,
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
      if (!live.current) setPhase('idle');
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

  function commit() {
    const session = live.current;
    if (!session || session.muted || session.awaiting || session.turnMs < 100 || session.socket.readyState !== WebSocket.OPEN) return;
    session.awaiting = true;
    session.turnMs = session.quietMs = session.voiceGate.speechMs = 0;
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
      session.turnMs = session.quietMs = session.voiceGate.speechMs = 0;
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

  function showInput(rms: number, threshold: number) {
    if (reduced) return;
    const now = performance.now();
    if (now - meter.current.updatedAt < 50) return;
    const level = voiceInputLevel(rms, threshold);
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
    // Measure in short windows even when the native recorder returns a larger buffer.
    for (let start = 0; start < samples.length && !session.awaiting; start += liveFrameSamples) {
      handleLiveFrame(session, samples.subarray(start, start + liveFrameSamples));
    }
  }

  function handleLiveFrame(session: Live, samples: Int16Array) {
    const ms = samples.length / liveSamplesPerMs;
    const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length) / 32768;
    const stage = session.turnMs ? 'continuing' : playing.current ? 'interrupting' : 'listening';
    const speaking = acceptLiveSpeech(session.voiceGate, rms, ms, stage);
    if (!playing.current) showInput(rms, liveVoiceThreshold(session.voiceGate, stage));
    if (!session.turnMs) {
      session.lead.push(samples);
      let leadSamples = session.lead.reduce((sum, frame) => sum + frame.length, 0);
      while (leadSamples > liveLeadSamples) leadSamples -= session.lead.shift()!.length;
      if (!speaking) return;
      if (playing.current) stopSpeech();
      for (const frame of session.lead) {
        session.socket.send(frame);
      }
      session.turnMs = leadSamples / liveSamplesPerMs;
      session.lead = [];
      return;
    }
    session.socket.send(samples);
    session.turnMs += ms;
    session.quietMs = speaking ? 0 : session.quietMs + ms;
    if (session.quietMs >= 800 || session.turnMs >= 59000) commit();
  }

  return {
    phase, error, voice, micMuted, speaking, inputLevel, replyPulse, recorder,
    startRecording, finishRecording, startLive, cancel, toggleMic, speak, stopSpeech,
  };
}
