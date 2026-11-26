const assert = require("node:assert/strict");
const {EventEmitter, once} = require("node:events");
const {test} = require("node:test");
const ws = require("ws");
const {WebSocket} = ws;
const {revision} = require("../mobile/src/data/catalog.json");

test("Dev text, recording and live share auth and reject unsupported provider results", {timeout: 15000}, async t => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.ASSISTANT_DEV_TOKEN = "test-token";
  const piperUrl = "http://127.0.0.1:5072/synthesize";
  process.env.ASSISTANT_PIPER_URL = piperUrl;
  const realFetch = globalThis.fetch;
  const spokenReply = "Вітаю, я Характерник.";
  const wav = Buffer.alloc(48);
  wav.write("RIFF", 0);
  wav.write("WAVE", 8);
  let speechUnavailable = false;
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
        setTimeout(() => this.event({type: "conversation.item.input_audio_transcription.completed", item_id: "turn-1", transcript: " Як отримати УБД? "}), 20);
      }
    }
    event(event) { this.emit("message", Buffer.from(JSON.stringify(event))); }
    terminate() {
      this.readyState = WebSocket.CLOSED;
      this.emit("terminated");
    }
  }
  ws.WebSocket = TestProvider;
  const server = require("../server.cjs");
  ws.WebSocket = WebSocket;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url === piperUrl) {
      assert.deepEqual(JSON.parse(options.body), {text: spokenReply, length_scale: 1.05});
      return new Response(speechUnavailable ? "unavailable" : wav, {headers: {"Content-Type": "text/html"}});
    }
    assert.equal(options.headers.Authorization, "Bearer test-key");
    if (url.endsWith("/audio/transcriptions")) {
      assert.equal(options.body.get("model"), "gpt-transcribe");
      assert.equal(options.body.get("file").type, "audio/mp4");
      assert.deepEqual(options.body.getAll("languages[]"), ["uk", "ru"]);
      assert(options.body.getAll("keywords[]").includes("в Одессе"));
      return Response.json({text: " УБД "});
    }
    const request = JSON.parse(options.body);
    const input = JSON.parse(request.input);
    assert(request.model === "gpt-6-luna" && request.store === false);
    const result = data => Response.json({output: [{type: "message", content: [{type: "output_text", text: JSON.stringify(data)}]}]});
    if (request.text.format.name === "guide_lookup") {
      const entries = [...request.instructions.matchAll(/^\s*(\d+)\. ([^\n]+)$/gm)];
      assert.equal(entries.length, require("../catalog.js").services.reduce((n, service) => n + 1 + service.sections.length, 0));
      const titles = selection === "sport-sources" ? ["Ветеранський спорт", "Чи можна отримати 1 500 грн у Дії"] :
        selection === "ambiguous" ? ["Реабілітація й протезування"] :
        selection === "context-overview" ? ["Ветеранський спорт"] :
        ["evidence", "invalid-evidence"].includes(selection) ? ["З чого почати після втрати кінцівки"] :
        ["Як отримати УБД", "Де знайти адаптивні тренування"];
      if (selection === "greeting" || selection === "bad-conversation") {
        return result({intent: selection === "greeting" ? "greeting" : "unapproved message", materials: []});
      }
      return result({intent: "guide", materials: selection === "invalid-lookup" ? [9999] :
        titles.map(title => Number(entries.find(entry => entry[2] === title)?.[1])).filter(Boolean)});
    }
    assert.equal(request.text.format.name, "catalogue_answers");
    assert(input.options.every(entry => entry.paragraphs.length > 0));
    const pick = (number, paragraphs = []) => ({number, paragraphs});
    if (selection === "sport-sources") return result({answers: [pick(1), pick(2, [2])], mode: "answer"});
    if (selection === "ambiguous" || selection === "context-overview") return result({answers: [pick(1)], mode: "answer"});
    if (selection === "evidence" || selection === "invalid-evidence") {
      assert.match(input.options[0].paragraphs[1], /лікар/);
      return result({answers: [pick(1, [selection === "evidence" ? 2 : 99])], mode: "answer"});
    }
    const answers = selection === "combined" ? [pick(1), pick(2)] :
      selection === "valid" || selection === "partial" ? [pick(1)] : ["empty", "empty-partial"].includes(selection) ? [] : [pick(999)];
    const mode = ["partial", "empty-partial"].includes(selection) ? "partial" : "answer";
    const content = [{type: "output_text", text: JSON.stringify({answers, mode})}];
    if (selection === "valid") content.unshift({type: "output_text", text: "Incomplete first attempt"});
    return Response.json({output: [{type: "message", content}]});
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
  assert.deepEqual(await (await realFetch(base, {headers: auth})).json(), {enabled: true, voice: true, speech: true, revision});
  const synthesize = (text, headers = auth) => realFetch(`${base}/speech`, {
    method: "POST", headers: {"Content-Type": "application/json", ...headers}, body: JSON.stringify({text})
  });
  assert.equal((await synthesize(spokenReply, {})).status, 403);
  assert.equal((await synthesize(" ")).status, 400);
  const spoken = await synthesize(spokenReply);
  assert.equal(spoken.headers.get("content-type"), "audio/wav");
  assert.deepEqual(Buffer.from(await spoken.arrayBuffer()), wav);
  speechUnavailable = true;
  assert.equal((await synthesize(spokenReply)).status, 502);
  assert.equal((await ask(question, {})).status, 403);
  assert.equal((await ask({...question, revision: "old"})).status, 409);
  assert.deepEqual(await (await ask(question)).json(), {answers: [], mode: "answer"});
  selection = "greeting";
  const greeting = {...question, question: "Хей, радий знайомству!"};
  assert.deepEqual(await (await ask(greeting)).json(), {answers: [], mode: "answer", conversation: "greeting"});
  selection = "bad-conversation";
  assert.equal((await ask(greeting)).status, 502);
  selection = "empty-partial";
  assert.deepEqual(await (await ask(question)).json(), {answers: [], mode: "answer"});
  selection = "valid";
  assert.deepEqual(await (await ask({...question, question: "Привіт! Які документи потрібні для УБД?"})).json(), {answers: [{route: "status", section: "ubd"}], mode: "answer"});
  selection = "combined";
  assert.deepEqual(await (await ask({...question, question: "Які документи потрібні для УБД і де знайти адаптивні тренування?"})).json(), {
    answers: [{route: "status", section: "ubd"}, {route: "veteran-sports", section: "training"}], mode: "answer"
  });
  selection = "partial";
  assert.deepEqual(await (await ask({...question, question: "Які документи потрібні для УБД і яка температура на Марсі?"})).json(), {
    answers: [{route: "status", section: "ubd"}], mode: "partial"
  });
  selection = "ambiguous";
  assert.deepEqual(await (await ask({...question, question: "Протези і пільги"})).json(), {
    answers: [{route: "rehab", section: null}, {route: "benefits", section: null}], mode: "clarify"
  });
  selection = "context-overview";
  const training = {route: "veteran-sports", section: "training"};
  assert.deepEqual(await (await ask({...question, question: "А как записаться?", previous: training})).json(), {
    answers: [training], mode: "answer"
  });
  selection = "invalid";
  assert.equal((await ask(question)).status, 502);
  const natural = {...question, question: "После ранения хожу на костылях, конечность спасти не удалось. С чего начать?"};
  selection = "evidence";
  assert.deepEqual(await (await ask(natural)).json(), {mode: "answer", answers: [{route: "rehab", section: "after-amputation", paragraphs: [1, 2]}]});
  selection = "sport-sources";
  const payment = (await (await ask({...question, question: "Чи можна зараз отримати гроші на спорт?"})).json()).answers;
  assert.equal(payment.length, 1);
  assert.equal(payment[0].section, "payment");
  assert(payment[0].paragraphs === undefined || payment[0].paragraphs.includes(1));
  for (selection of ["invalid-lookup", "invalid-evidence"]) assert.equal((await ask(natural)).status, 502);
  const szch = {route: "legal", section: "szch-meaning"};
  assert.deepEqual(await (await ask({...question, question: "Что такое вообще СЗЧ?"})).json(), {answers: [szch], mode: "answer"});
  assert.deepEqual(await (await ask({...question, question: "А розкажи докладніше", previous: szch})).json(), {
    answers: [{route: "legal", section: "szch-record"}], mode: "answer"
  });
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
  client.send("keepalive");
  const [transcript] = await once(client, "message");
  assert.deepEqual(JSON.parse(transcript), {type: "transcript", text: "Як отримати УБД?"});
  assert.deepEqual(upstream.sent.map(event => event.type), ["session.update", "input_audio_buffer.append", "input_audio_buffer.commit"]);
  assert.deepEqual(upstream.sent[0].session.audio.input.transcription.languages, ["uk", "ru"]);
  const shutdown = Promise.all([once(client, "close"), once(upstream, "terminated")]);
  client.close();
  await shutdown;
  assert.equal(upstream.readyState, WebSocket.CLOSED);
});
