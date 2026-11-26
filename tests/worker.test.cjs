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
  assert.equal((await worker.fetch(new Request(endpoint + "/transcribe", {method: "POST"}), env)).status, 404);
  assert.equal((await worker.fetch(new Request(endpoint), env)).status, 405);
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
