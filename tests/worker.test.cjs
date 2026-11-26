const assert = require("node:assert/strict");
const {register} = require("node:module");
const {test} = require("node:test");
const {revision} = require("../assistant-text.cjs");

register("data:text/javascript," + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (specifier === "cloudflare:workers") {
      return {shortCircuit: true, url: "data:text/javascript,export class DurableObject {}"};
    }
    return next(specifier, context);
  }
`));

test("Store speech sends only bounded reply text to Leonid and charges the speech budget", async t => {
  const {default: worker, AssistantQuota} = await import("../worker.mjs");
  const records = new Map();
  const text = "Вітаю, я Леонід.";
  const env = {
    ASSISTANT_ENABLED: "true", OPENAI_API_KEY: "test-key", ASSISTANT_VOICE_ENABLED: "true",
    ASSISTANT_SPEECH_DAILY_CHARS: String(text.length),
  };
  const quota = new AssistantQuota({storage: {
    kv: {get: key => records.get(key), put: (key, value) => records.set(key, value)},
    transactionSync: work => work(),
  }}, env);
  env.ASSISTANT_RATE = {limit: async () => ({success: true})};
  env.ASSISTANT_QUOTA = {getByName: () => ({fetch: (url, options) => quota.fetch(new Request(url, options))})};
  const endpoint = "https://test.example/api/assistant";
  const speak = payload => worker.fetch(new Request(endpoint + "/speech", {
    method: "POST", headers: {"Content-Type": "application/json; charset=utf-8"}, body: JSON.stringify(payload),
  }), env);

  assert.equal((await speak({text})).status, 503);
  env.ELEVENLABS_API_KEY = "test-eleven-key";
  assert.deepEqual(await (await worker.fetch(new Request(endpoint), env)).json(), {enabled: true, voice: true, speech: true, revision});
  assert.equal((await worker.fetch(new Request(endpoint + "/speech"), env)).status, 405);
  assert.equal((await speak({text: " "})).status, 400);
  assert.equal((await speak({text: "я".repeat(8001)})).status, 400);
  assert.equal((await speak({text, padding: "a".repeat(32768)})).status, 413);
  assert.equal(records.size, 0);

  const mp3 = new Uint8Array(64);
  mp3.set(new TextEncoder().encode("ID3"));
  const provider = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.elevenlabs.io/v1/text-to-speech/eLDtXX7z65CuLasDRxrP?output_format=mp3_44100_128");
    assert.equal(options.headers["xi-api-key"], "test-eleven-key");
    assert.equal(options.redirect, "manual");
    assert.deepEqual(JSON.parse(options.body), {text, model_id: "eleven_flash_v2_5", language_code: "uk"});
    return new Response(mp3);
  });
  const response = await speak({text: ` ${text} `, question: "private", history: []});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "audio/mpeg");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), mp3);
  assert.deepEqual([...records.keys()], ["speech-daily"]);
  assert.equal(records.get("speech-daily").count, text.length);
  assert.equal((await speak({text})).status, 429);
  assert.equal(provider.mock.callCount(), 1);
});

test("Store assistant sends only valid text requests to the shared model and respects both limits", async t => {
  const {default: worker, AssistantQuota} = await import("../worker.mjs");
  const records = new Map();
  const env = {ASSISTANT_ENABLED: "true", ASSISTANT_DAILY_LIMIT: "1", OPENAI_API_KEY: "test-key"};
  const quota = new AssistantQuota({storage: {
    kv: {get: key => records.get(key), put: (key, value) => records.set(key, value)},
    transactionSync: work => work(),
  }}, env);
  let rateAllowed = true;
  env.ASSISTANT_RATE = {limit: async ({key}) => {
    assert.equal(key, "192.0.2.3");
    return {success: rateAllowed};
  }};
  env.ASSISTANT_QUOTA = {getByName: () => ({fetch: (url, options) => quota.fetch(new Request(url, options))})};
  env.ASSETS = {fetch: req => new Response(new URL(req.url).pathname)};
  let modelCalls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    modelCalls++;
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    const input = JSON.parse(body.input);
    if (body.text.format.name === "guide_lookup") {
      const number = Number(body.instructions.match(/(\d+)\. З чого почати після втрати кінцівки/u)[1]);
      assert.equal(input.question, "Кінцівку не вдалося зберегти. З чого почати?");
      return Response.json({output: [{type: "message", content: [{type: "output_text", text: JSON.stringify({intent: "guide", materials: [number]})}]}]});
    }
    assert.match(input.options[0].paragraphs[1], /лікар/u);
    return Response.json({output: [{type: "message", content: [{type: "output_text", text: '{"mode":"answer","answers":[{"number":1,"paragraphs":[2]}]}'}]}]});
  });
  const root = "https://test.example";
  const endpoint = root + "/api/assistant";
  const ask = (payload, overrides = {}) => worker.fetch(new Request(endpoint, {
    method: "POST", headers: {"Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.3"},
    body: JSON.stringify(payload), ...overrides,
  }), env);
  const prompt = {question: "Кінцівку не вдалося зберегти. З чого почати?", revision};
  assert.equal(await (await worker.fetch(new Request(root + "/privacy.html"), env)).text(), "/privacy.html");
  assert.equal((await worker.fetch(new Request(endpoint + "/transcribe", {method: "POST"}), env)).status, 503);
  assert.deepEqual(await (await worker.fetch(new Request(endpoint), env)).json(), {enabled: true, voice: false, speech: false, revision});
  env.ASSISTANT_ENABLED = "false";
  assert.equal((await ask(prompt)).status, 503);
  env.ASSISTANT_ENABLED = "true";
  assert.equal((await ask({...prompt, revision: "old"})).status, 409);
  assert.equal((await ask({...prompt, padding: "a".repeat(4096)})).status, 413);
  assert.equal((await ask(prompt, {body: "{"})).status, 400);
  assert.equal(modelCalls, 0);
  const onlineReply = await ask(prompt);
  assert.equal(onlineReply.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await onlineReply.json(), {
    mode: "answer", answers: [{route: "rehab", section: "after-amputation", paragraphs: [1, 2]}]
  });
  assert.equal((await ask(prompt)).status, 429);
  assert.equal(modelCalls, 2);
  assert.equal((await ask({...prompt, question: "Що таке УБД?"})).status, 200);
  rateAllowed = false;
  assert.equal((await ask({...prompt, question: "Що таке УБД?"})).status, 429);
  assert.equal(records.get("daily").count, 1);
});

test("Store voice validates uploads and shares a separate daily limit with live sessions", async t => {
  const {default: worker, AssistantQuota} = await import("../worker.mjs");
  const records = new Map();
  const env = {
    ASSISTANT_ENABLED: "true", ASSISTANT_VOICE_ENABLED: "true",
    ASSISTANT_DAILY_LIMIT: "1", ASSISTANT_VOICE_DAILY_MINUTES: "6", OPENAI_API_KEY: "test-key",
    ASSISTANT_RATE: {limit: async () => ({success: true})},
  };
  const quota = new AssistantQuota({storage: {
    kv: {get: key => records.get(key), put: (key, value) => records.set(key, value)},
    transactionSync: work => work(),
  }}, env);
  env.ASSISTANT_QUOTA = {getByName: () => ({fetch: (url, options) => quota.fetch(new Request(url, options))})};
  let upstreamCalls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    upstreamCalls++;
    assert.equal(options.headers.Authorization, "Bearer test-key");
    if (url.endsWith("/audio/transcriptions")) {
      assert.equal(options.body.get("model"), "gpt-transcribe");
      assert.equal(options.body.get("file").type, "audio/wav");
      assert.equal(options.body.get("file").size, 44 + 16000 * 2 * 60);
      return Response.json({text: " Добрий день "});
    }
    assert.match(url, /intent=transcription$/);
    assert.equal(options.headers.Upgrade, "websocket");
    return new Response(null, {status: 502});
  });
  const endpoint = "https://test.example/api/assistant";
  const record = (type, body) => worker.fetch(new Request(endpoint + "/transcribe", {
    method: "POST", headers: {"Content-Type": type}, body,
  }), env);
  const live = headers => worker.fetch(new Request(endpoint + "/live", {headers}), env);
  const wav = Buffer.alloc(44 + 16000 * 2 * 61);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  assert.deepEqual(await (await worker.fetch(new Request(endpoint), env)).json(), {enabled: true, voice: true, speech: false, revision});
  assert.equal((await record("text/plain", "not audio")).status, 415);
  assert.equal((await record("audio/wav", null)).status, 400);
  assert.equal((await record("audio/wav", new Uint8Array(100))).status, 400);
  assert.equal((await record("audio/wav", new Uint8Array(2 * 1024 * 1024 + 1))).status, 413);
  assert.equal((await live()).status, 426);
  assert.equal(upstreamCalls, 0);
  assert.deepEqual(await (await record("audio/wav", wav)).json(), {text: "Добрий день"});
  assert.equal((await live({Upgrade: "websocket"})).status, 502);
  assert.equal((await live({Upgrade: "websocket"})).status, 429);
  assert.equal((await record("audio/wav", wav)).status, 429);
  assert.equal(upstreamCalls, 2);
  assert.equal(records.get("voice-daily").count, 6);
  assert.equal(records.has("daily"), false);
});
