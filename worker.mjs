import { DurableObject } from 'cloudflare:workers';
import assistant from './assistant-text.cjs';

const { answerQuestion, parseQuestion } = assistant;
const bodyLimit = 4096;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function readQuestion(body) {
  if (!body) return { status: 400, error: 'Invalid request' };
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > bodyLimit) {
        await reader.cancel();
        return { status: 413, error: 'Question too long' };
      }
      text += decoder.decode(value, { stream: true });
    }
    return parseQuestion(JSON.parse(text + decoder.decode()));
  } catch {
    return { status: 400, error: 'Invalid request' };
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname !== '/api/assistant') {
      return pathname.startsWith('/api/') ? json({ error: 'Not found' }, 404) : env.ASSETS.fetch(request);
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (env.ASSISTANT_ENABLED !== 'true' || !env.OPENAI_API_KEY) return json({ error: 'Assistant unavailable' }, 503);
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({ error: 'Expected JSON' }, 415);
    }
    if (Number(request.headers.get('Content-Length')) > bodyLimit) return json({ error: 'Question too long' }, 413);
    try {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!(await env.ASSISTANT_RATE.limit({ key: ip })).success) return json({ error: 'Rate limit' }, 429);
      const parsed = await readQuestion(request.body);
      if (parsed.error) return json({ error: parsed.error }, parsed.status);
      const reply = await answerQuestion(parsed, { key: env.OPENAI_API_KEY, model: env.OPENAI_MODEL }, async () => {
        const result = await env.ASSISTANT_QUOTA.getByName('daily').fetch('https://quota.internal/', { method: 'POST' });
        if (result.status !== 429 && !result.ok) throw new Error('Quota unavailable');
        return result.ok;
      });
      return reply ? json(reply) : json({ error: 'Daily limit' }, 429);
    } catch {
      return json({ error: 'Assistant unavailable' }, 502);
    }
  },
};

export class AssistantQuota extends DurableObject {
  constructor(state, env) {
    super(state, env);
    this.storage = state.storage;
    this.limit = Number(env.ASSISTANT_DAILY_LIMIT);
  }

  fetch(request) {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    if (!Number.isSafeInteger(this.limit) || this.limit <= 0) return new Response(null, { status: 503 });
    const day = new Date().toISOString().slice(0, 10);
    const allowed = this.storage.transactionSync(() => {
      const previous = this.storage.kv.get('daily');
      const count = previous?.day === day ? previous.count : 0;
      if (count >= this.limit) return false;
      this.storage.kv.put('daily', { day, count: count + 1 });
      return true;
    });
    return new Response(null, { status: allowed ? 204 : 429 });
  }
}
