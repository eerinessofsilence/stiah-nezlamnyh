const http = require("node:http");
const {createHash, timingSafeEqual} = require("node:crypto");
const {readFile} = require("node:fs/promises");
const path = require("node:path");
const {WebSocket, WebSocketServer} = require("ws");
const {revision, parseQuestion, answerQuestion} = require("./assistant-text.cjs");

const port = Number(process.env.PORT || 4173);
const key = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL;
const llamaUrl = process.env.ASSISTANT_LLAMA_URL;
const piperUrl = process.env.ASSISTANT_PIPER_URL;
if (llamaUrl && !/^http:\/\/127\.0\.0\.1:[0-9]+\/v1\/chat\/completions$/.test(llamaUrl)) {
  throw new Error("ASSISTANT_LLAMA_URL must be a loopback llama.cpp chat completions URL");
}
if (piperUrl && !/^http:\/\/127\.0\.0\.1:[0-9]+\/synthesize$/.test(piperUrl)) {
  throw new Error("ASSISTANT_PIPER_URL must be a loopback Piper synthesis URL");
}
const modelEnabled = Boolean(llamaUrl || key);
const origins = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);
if (process.env.APP_ORIGIN) origins.add(new URL(process.env.APP_ORIGIN).origin);
const digest = value => createHash("sha256").update(value).digest();
const token = process.env.ASSISTANT_DEV_TOKEN && digest(`Bearer ${process.env.ASSISTANT_DEV_TOKEN}`);
const publicFiles = new Set(["privacy.html", "support.html", "store-info.css"]);
const mime = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8"};
const audioTypes = {"audio/mp4": "m4a", "audio/m4a": "m4a", "audio/aac": "aac"};
const speechLanguages = ["uk", "ru"];
const speechKeywords = ["УБД", "СЗЧ", "ВЛК", "ЕКОПФО", "ТЦК та СП", "ПФУ", "ЦНАП", "Одеса", "в Одесі", "в Одессе"];
const quotas = new Map();

function authorized(request) {
  return (!request.headers.origin || origins.has(request.headers.origin)) &&
    (!token || timingSafeEqual(token, digest(request.headers.authorization || "")));
}

function withinQuota(name, limit) {
  const minute = Math.floor(Date.now() / 60000);
  const previous = quotas.get(name);
  const count = previous?.minute === minute ? previous.count + 1 : 1;
  if (count > limit) return false;
  quotas.set(name, {minute, count});
  return true;
}

function json(response, status, data) {
  response.writeHead(status, {"Content-Type": "application/json", "Cache-Control": "no-store"});
  response.end(JSON.stringify(data));
}

async function readBody(request, limit) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request.iterator({destroyOnReturn: false})) {
    bytes += chunk.length;
    if (bytes > limit) {
      request.resume();
      return null;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function assistant(request, response) {
  if (request.method === "GET") return json(response, 200, {enabled: modelEnabled, voice: Boolean(key), speech: Boolean(piperUrl), revision});
  if (request.method !== "POST") return json(response, 405, {error: "Method not allowed"});
  if (!modelEnabled) return json(response, 503, {error: "AI unavailable"});
  if (request.headers["content-type"] !== "application/json") return json(response, 415, {error: "Expected JSON"});
  if (!withinQuota("text", 60)) return json(response, 429, {error: "Rate limit"});
  let payload;
  try {
    const body = await readBody(request, 4096);
    if (!body) return json(response, 413, {error: "Question too long"});
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return json(response, 400, {error: "Invalid request"});
  }
  const parsed = parseQuestion(payload);
  if (parsed.error) return json(response, parsed.status, {error: parsed.error});
  try {
    return json(response, 200, await answerQuestion(parsed, {key, model, llamaUrl}));
  } catch {
    return json(response, 502, {error: "AI unavailable"});
  }
}

async function speech(request, response) {
  if (request.method !== "POST") return json(response, 405, {error: "Method not allowed"});
  if (!piperUrl) return json(response, 503, {error: "Speech unavailable"});
  if (request.headers["content-type"] !== "application/json") return json(response, 415, {error: "Expected JSON"});
  if (!withinQuota("speech", 24)) return json(response, 429, {error: "Rate limit"});
  let text;
  try {
    const body = await readBody(request, 32 * 1024);
    if (!body) return json(response, 413, {error: "Speech text too long"});
    text = JSON.parse(body.toString("utf8"))?.text;
  } catch {
    return json(response, 400, {error: "Invalid speech request"});
  }
  if (typeof text !== "string" || !text.trim() || text.length > 8000) {
    return json(response, 400, {error: "Invalid speech text"});
  }
  try {
    const audio = await fetch(piperUrl, {
      method: "POST", headers: {"Content-Type": "application/json"}, redirect: "error",
      body: JSON.stringify({text, length_scale: 1.05}), signal: AbortSignal.timeout(14000)
    });
    if (!audio.ok || Number(audio.headers.get("content-length")) > 12 * 1024 * 1024) throw new Error();
    const wav = Buffer.from(await audio.arrayBuffer());
    // Piper 1.8 can label its WAV as text/html, so check the file signature.
    if (wav.length <= 44 || wav.length > 12 * 1024 * 1024 ||
        wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") throw new Error();
    response.writeHead(200, {"Content-Type": "audio/wav", "Content-Length": wav.length, "Cache-Control": "no-store"});
    response.end(wav);
  } catch {
    return json(response, 502, {error: "Speech unavailable"});
  }
}

async function transcribe(request, response) {
  if (request.method !== "POST") return json(response, 405, {error: "Method not allowed"});
  if (!key) return json(response, 503, {error: "Voice unavailable"});
  const type = request.headers["content-type"];
  if (!Object.hasOwn(audioTypes, type)) return json(response, 415, {error: "Unsupported audio"});
  if (!withinQuota("recording", 12)) return json(response, 429, {error: "Rate limit"});
  const body = await readBody(request, 2 * 1024 * 1024);
  if (!body) return json(response, 413, {error: "Audio too large"});
  if (!body.length) return json(response, 400, {error: "Empty audio"});
  const form = new FormData();
  form.set("file", new Blob([body], {type}), "question." + audioTypes[type]);
  form.set("model", "gpt-transcribe");
  form.set("prompt", "Питання до ветеранського гіда українською або російською. Можливі короткі уточнення, адреси та абревіатури.");
  for (const language of speechLanguages) form.append("languages[]", language);
  for (const keyword of speechKeywords) form.append("keywords[]", keyword);
  try {
    const result = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: {Authorization: `Bearer ${key}`}, body: form, signal: AbortSignal.timeout(18000)
    });
    if (!result.ok) throw new Error("Transcription unavailable");
    const {text} = await result.json();
    if (typeof text !== "string") throw new Error("Invalid transcription");
    return json(response, 200, {text: text.trim()});
  } catch {
    return json(response, 502, {error: "Transcription unavailable"});
  }
}

const liveServer = new WebSocketServer({noServer: true, maxPayload: 32 * 1024});

function liveSession(client) {
  const upstream = new WebSocket("wss://api.openai.com/v1/realtime?intent=transcription", {
    headers: {Authorization: `Bearer ${key}`}, handshakeTimeout: 8000
  });
  let ready = false;
  let bytes = 0;
  let turnBytes = 0;
  let pending = false;
  let itemId;
  let resultTimer;
  const send = (socket, event) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
  };
  const close = (code = 1011) => {
    if (client.readyState === WebSocket.OPEN) client.close(code);
  };
  const timeout = setTimeout(() => close(1000), 5 * 60_000);
  const idle = setTimeout(() => close(1000), 45_000);
  client.on("close", () => {
    clearTimeout(timeout);
    clearTimeout(idle);
    clearTimeout(resultTimer);
    upstream.terminate();
  });
  client.on("error", () => client.terminate());
  upstream.on("error", () => close());
  upstream.on("close", () => close());
  upstream.on("open", () => send(upstream, {
    type: "session.update", session: {type: "transcription", audio: {input: {
      format: {type: "audio/pcm", rate: 24000}, turn_detection: null,
      transcription: {model: "gpt-live-transcribe", languages: speechLanguages, keywords: speechKeywords}
    }}}
  }));
  upstream.on("message", raw => {
    let event;
    try { event = JSON.parse(raw.toString()); } catch { return close(); }
    if (event.type === "session.updated" && !ready) {
      ready = true;
      send(client, {type: "ready"});
    }
    if (event.type === "input_audio_buffer.committed" && pending) itemId = event.item_id;
    if (pending && itemId && event.item_id === itemId &&
        ["conversation.item.input_audio_transcription.completed", "conversation.item.input_audio_transcription.failed"].includes(event.type)) {
      clearTimeout(resultTimer);
      pending = false;
      itemId = undefined;
      send(client, {type: "transcript", text: typeof event.transcript === "string" ? event.transcript.trim() : ""});
    }
    if (event.type === "error") close();
  });
  client.on("message", (raw, binary) => {
    if (!ready) return close(1008);
    const command = binary ? null : raw.toString();
    if (command === "keepalive") {
      idle.refresh();
      return;
    }
    if (pending) return close(1008);
    if (binary) {
      if (!raw.length || raw.length % 2 || upstream.bufferedAmount > 256 * 1024) return close(1008);
      bytes += raw.length;
      turnBytes += raw.length;
      if (bytes > 24000 * 2 * 300 || turnBytes > 24000 * 2 * 60) return close(1008);
      idle.refresh();
      send(upstream, {type: "input_audio_buffer.append", audio: raw.toString("base64")});
    } else if (command === "commit" && turnBytes >= 4800) {
      pending = true;
      turnBytes = 0;
      resultTimer = setTimeout(() => close(), 12000);
      send(upstream, {type: "input_audio_buffer.commit"});
    } else if (command === "clear") {
      turnBytes = 0;
      send(upstream, {type: "input_audio_buffer.clear"});
    } else close(1008);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/api/assistant" || pathname === "/api/assistant/transcribe" || pathname === "/api/assistant/speech") {
      if (!authorized(request)) return json(response, 403, {error: "Request not allowed"});
      if (pathname === "/api/assistant/speech") return await speech(request, response);
      return await (pathname === "/api/assistant" ? assistant : transcribe)(request, response);
    }
    const file = pathname.slice(1);
    if (!publicFiles.has(file) || !["GET", "HEAD"].includes(request.method)) {
      return json(response, 404, {error: "Not found"});
    }
    const data = await readFile(path.join(__dirname, file));
    response.writeHead(200, {
      "Content-Type": mime[path.extname(file)],
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch {
    if (!response.headersSent) json(response, 500, {error: "Server error"});
  }
});

server.on("upgrade", (request, socket, head) => {
  if (request.url !== "/api/assistant/live" || !authorized(request)) {
    return socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
  }
  if (!key || liveServer.clients.size >= 10 || !withinQuota("live", 12)) {
    return socket.end("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n");
  }
  liveServer.handleUpgrade(request, socket, head, liveSession);
});

if (require.main === module) server.listen(port, "127.0.0.1", () => {
  console.log(`Гід: Стяг незламних · http://127.0.0.1:${port} · AI ${llamaUrl ? "llama.cpp" : key ? "OpenAI" : "disabled"}`);
});

module.exports = server;
