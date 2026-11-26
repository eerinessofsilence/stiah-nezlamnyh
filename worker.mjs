import { DurableObject } from 'cloudflare:workers';
import assistant from './assistant-text.cjs';
import voice from './assistant-voice.cjs';

const { answerQuestion, parseQuestion, revision } = assistant;
const {
  recordingLimit, liveTranscriptionUrl, normalizeVoiceRecording, transcribeAudio, relayLiveTranscription,
  speechBodyLimit, speechText, synthesizeSpeech,
} = voice;
const bodyLimit = 4096;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readBytes(body, limit) {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function takeQuota(env, path = '/') {
  const result = await env.ASSISTANT_QUOTA.getByName('daily').fetch('https://quota.internal' + path, { method: 'POST' });
  if (result.status !== 429 && !result.ok) throw new Error('Quota unavailable');
  return result.ok;
}

async function record(request, env) {
  const type = request.headers.get('Content-Type');
  if (type !== 'audio/wav') return json({ error: 'Unsupported audio' }, 415);
  if (Number(request.headers.get('Content-Length')) > recordingLimit) return json({ error: 'Audio too large' }, 413);
  const body = await readBytes(request.body, recordingLimit);
  if (!body) return json({ error: 'Audio too large' }, 413);
  const recording = normalizeVoiceRecording(body);
  if (!recording) return json({ error: 'Invalid audio' }, 400);
  if (!await takeQuota(env, '/recording')) return json({ error: 'Daily voice limit' }, 429);
  return json({ text: await transcribeAudio(recording, type, env.OPENAI_API_KEY) });
}

async function live(request, env) {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Expected WebSocket' }, 426);
  if (!await takeQuota(env, '/live')) return json({ error: 'Daily voice limit' }, 429);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let upstream;
  try {
    const response = await fetch(liveTranscriptionUrl, {
      headers: { Upgrade: 'websocket', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      redirect: 'manual', signal: controller.signal,
    });
    if (response.status === 101) upstream = response.webSocket;
  } finally {
    clearTimeout(timeout);
  }
  if (!upstream) throw new Error('Transcription unavailable');
  const [client, server] = Object.values(new WebSocketPair());
  server.binaryType = 'arraybuffer';
  upstream.accept();
  server.accept();
  relayLiveTranscription(server, upstream);
  return new Response(null, { status: 101, webSocket: client });
}

async function speech(request, env) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'Expected JSON' }, 415);
  }
  if (Number(request.headers.get('Content-Length')) > speechBodyLimit) return json({ error: 'Speech text too long' }, 413);
  const bytes = await readBytes(request.body, speechBodyLimit);
  if (!bytes) return json({ error: 'Speech text too long' }, 413);
  let text;
  try {
    text = speechText(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch {
    return json({ error: 'Invalid speech request' }, 400);
  }
  if (!text) return json({ error: 'Invalid speech text' }, 400);
  if (!await takeQuota(env, '/speech?characters=' + text.length)) return json({ error: 'Daily speech limit' }, 429);
  const audio = await synthesizeSpeech(text, { elevenLabsKey: env.ELEVENLABS_API_KEY, elevenLabsVoice: env.ELEVENLABS_VOICE_ID });
  return new Response(audio.bytes, { headers: { 'Content-Type': audio.type, 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const assistant = pathname === '/api/assistant';
    const recording = pathname === '/api/assistant/transcribe';
    const conversation = pathname === '/api/assistant/live';
    const synthesis = pathname === '/api/assistant/speech';
    if (!assistant && !recording && !conversation && !synthesis) {
      return pathname.startsWith('/api/') ? json({ error: 'Not found' }, 404) : env.ASSETS.fetch(request);
    }
    const enabled = env.ASSISTANT_ENABLED === 'true' && Boolean(env.OPENAI_API_KEY);
    const voiceEnabled = enabled && env.ASSISTANT_VOICE_ENABLED === 'true';
    const speechEnabled = voiceEnabled && Boolean(env.ELEVENLABS_API_KEY);
    if (assistant && request.method === 'GET') return json({ enabled, voice: voiceEnabled, speech: speechEnabled, revision });
    if (request.method !== (conversation ? 'GET' : 'POST')) return json({ error: 'Method not allowed' }, 405);
    if (!enabled || ((recording || conversation) && !voiceEnabled) || (synthesis && !speechEnabled)) {
      return json({ error: 'Assistant unavailable' }, 503);
    }
    try {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!(await env.ASSISTANT_RATE.limit({ key: ip })).success) return json({ error: 'Rate limit' }, 429);
      if (recording) return await record(request, env);
      if (conversation) return await live(request, env);
      if (synthesis) return await speech(request, env);
      if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return json({ error: 'Expected JSON' }, 415);
      }
      if (Number(request.headers.get('Content-Length')) > bodyLimit) return json({ error: 'Question too long' }, 413);
      let parsed;
      try {
        const bytes = await readBytes(request.body, bodyLimit);
        if (!bytes) return json({ error: 'Question too long' }, 413);
        parsed = parseQuestion(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
      } catch {
        return json({ error: 'Invalid request' }, 400);
      }
      if (parsed.error) return json({ error: parsed.error }, parsed.status);
      const reply = await answerQuestion(parsed, { key: env.OPENAI_API_KEY, model: env.OPENAI_MODEL }, () => takeQuota(env));
      return reply ? json(reply) : json({ error: 'Daily limit' }, 429);
    } catch {
      if (synthesis) return json({ error: 'Speech unavailable' }, 502);
      return json({ error: 'Assistant unavailable' }, 502);
    }
  },
};

export class AssistantQuota extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.storage = state.storage;
    this.limit = Number(env.ASSISTANT_DAILY_LIMIT);
    this.voiceLimit = Number(env.ASSISTANT_VOICE_DAILY_MINUTES);
    this.speechLimit = Number(env.ASSISTANT_SPEECH_DAILY_CHARS);
  }

  fetch(request) {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    const { pathname, searchParams } = new URL(request.url);
    const synthesis = pathname === '/speech';
    const voice = pathname !== '/';
    const limit = synthesis ? this.speechLimit : voice ? this.voiceLimit : this.limit;
    const key = synthesis ? 'speech-daily' : voice ? 'voice-daily' : 'daily';
    const units = synthesis ? Number(searchParams.get('characters')) : pathname === '/live' ? 5 : 1;
    if (!Number.isSafeInteger(limit) || limit <= 0) return new Response(null, { status: 503 });
    if (!Number.isSafeInteger(units) || units < 1) return new Response(null, { status: 400 });
    const day = new Date().toISOString().slice(0, 10);
    const allowed = this.storage.transactionSync(() => {
      const previous = this.storage.kv.get(key);
      const count = previous?.day === day ? previous.count : 0;
      if (count + units > limit) return false;
      this.storage.kv.put(key, { day, count: count + units });
      return true;
    });
    return new Response(null, { status: allowed ? 204 : 429 });
  }
}
