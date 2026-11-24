const assert = require("node:assert/strict");
const {EventEmitter, once} = require("node:events");
const {test} = require("node:test");
const ws = require("ws");
const {WebSocket} = ws;
const {revision} = require("../mobile/src/data/catalog.json");

test("Dev text, recording and live share auth and reject unsupported provider results", {timeout: 15000}, async t => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.ASSISTANT_DEV_TOKEN = "test-token";
  const realFetch = globalThis.fetch;
  let selection = "empty";
  let upstream;
  class TestProvider extends EventEmitter {
    static OPEN = WebSocket.OPEN;
    readyState = WebSocket.OPEN;
    bufferedAmount = 0;
    sent = [];
    constructor(url) {
      super();
      assert.match(url, /intent=transcription$/);
      upstream = this;
      queueMicrotask(() => this.emit("open"));
    }
    send(message) {
      const event = JSON.parse(message);
      this.sent.push(event);
      if (event.type === "session.update") this.event({type: "session.updated"});
      if (event.type === "input_audio_buffer.commit") {
        this.event({type: "input_audio_buffer.committed", item_id: "turn-1"});
        this.event({type: "conversation.item.input_audio_transcription.completed", item_id: "other", transcript: "skip"});
        this.event({type: "conversation.item.input_audio_transcription.completed", item_id: "turn-1", transcript: " Як отримати УБД? "});
      }
    }
    event(event) { this.emit("message", Buffer.from(JSON.stringify(event))); }
    terminate() { this.readyState = WebSocket.CLOSED; }
  }
  ws.WebSocket = TestProvider;
  const server = require("../server.cjs");
  ws.WebSocket = WebSocket;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-key");
    if (url.endsWith("/audio/transcriptions")) {
      assert.equal(options.body.get("model"), "gpt-transcribe");
      assert.equal(options.body.get("file").type, "audio/mp4");
      return Response.json({text: " УБД "});
    }
    const request = JSON.parse(options.body);
    const input = JSON.parse(request.input);
    assert(request.model === "gpt-6-luna" && request.store === false);
    assert(input.options.length <= 18);
    const match = input.options.find(entry => entry.route === "status" && entry.section === "ubd");
    assert(match);
    const answers = selection === "valid" ? [match.number] : selection === "empty" ? [] : [999];
    return Response.json({output: [{type: "message", content: [{type: "output_text", text: JSON.stringify({answers})}]}]});
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api/assistant`;
  const auth = {Authorization: "Bearer test-token"};
  const ask = (payload, headers = auth) => realFetch(base, {
    method: "POST", headers: {"Content-Type": "application/json", ...headers}, body: JSON.stringify(payload)
  });
  const question = {question: "Які документи потрібні для УБД?", revision};
  assert.deepEqual(await (await realFetch(base, {headers: auth})).json(), {enabled: true, voice: true, revision});
  assert.equal((await ask(question, {})).status, 403);
  assert.equal((await ask({...question, revision: "old"})).status, 409);
  assert.deepEqual(await (await ask(question)).json(), {answers: []});
  selection = "valid";
  assert.deepEqual(await (await ask(question)).json(), {answers: [{route: "status", section: "ubd"}]});
  selection = "invalid";
  assert.equal((await ask(question)).status, 502);
  const record = type => realFetch(base + "/transcribe", {
    method: "POST", headers: {...auth, "Content-Type": type}, body: new Uint8Array([1, 2])
  });
  assert.equal((await record("text/plain")).status, 415);
  assert.deepEqual(await (await record("audio/mp4")).json(), {text: "УБД"});

  const url = base.replace("http", "ws") + "/live";
  const denied = new WebSocket(url);
  const [error] = await once(denied, "error");
  assert.match(error.message, /403/);
  const client = new WebSocket(url, {headers: auth});
  t.after(() => client.terminate());
  const [ready] = await once(client, "message");
  assert.deepEqual(JSON.parse(ready), {type: "ready"});
  client.send(Buffer.alloc(4800));
  client.send("commit");
  const [transcript] = await once(client, "message");
  assert.deepEqual(JSON.parse(transcript), {type: "transcript", text: "Як отримати УБД?"});
  assert.deepEqual(upstream.sent.map(event => event.type), ["session.update", "input_audio_buffer.append", "input_audio_buffer.commit"]);
  client.close();
  await once(client, "close");
  assert.equal(upstream.readyState, WebSocket.CLOSED);
});
