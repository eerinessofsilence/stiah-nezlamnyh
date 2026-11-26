const http = require("node:http");
const {createHash, timingSafeEqual} = require("node:crypto");
const {readFile} = require("node:fs/promises");
const path = require("node:path");
const {WebSocket, WebSocketServer} = require("ws");
const {revision, parseQuestion, answerQuestion} = require("./assistant-text.cjs");
const {
  audioTypes, recordingLimit, liveFrameLimit, liveTranscriptionUrl, transcribeAudio, relayLiveTranscription,
  speechBodyLimit, speechText, synthesizeSpeech,
} = require("./assistant-voice.cjs");

const port = Number(process.env.PORT || 4173);
const key = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL;
const llamaUrl = process.env.ASSISTANT_LLAMA_URL;
const piperUrl = process.env.ASSISTANT_PIPER_URL;
const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
const elevenLabsVoice = process.env.ELEVENLABS_VOICE_ID;
if (llamaUrl && !/^http:\/\/127\.0\.0\.1:[0-9]+\/v1\/chat\/completions$/.test(llamaUrl)) {
  throw new Error("ASSISTANT_LLAMA_URL must be a loopback llama.cpp chat completions URL");
}
if (piperUrl && !/^http:\/\/127\.0\.0\.1:[0-9]+\/synthesize$/.test(piperUrl)) {
  throw new Error("ASSISTANT_PIPER_URL must be a loopback Piper synthesis URL");
}
const modelEnabled = Boolean(llamaUrl || key);
const speechEnabled = Boolean(elevenLabsKey || piperUrl);
const origins = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);
if (process.env.APP_ORIGIN) origins.add(new URL(process.env.APP_ORIGIN).origin);
const digest = value => createHash("sha256").update(value).digest();
const token = process.env.ASSISTANT_DEV_TOKEN && digest(`Bearer ${process.env.ASSISTANT_DEV_TOKEN}`);
const publicFiles = new Set(["privacy.html", "support.html", "store-info.css"]);
const mime = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8"};
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
  if (request.method === "GET") return json(response, 200, {enabled: modelEnabled, voice: Boolean(key), speech: speechEnabled, revision});
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
  if (!speechEnabled) return json(response, 503, {error: "Speech unavailable"});
  if (request.headers["content-type"] !== "application/json") return json(response, 415, {error: "Expected JSON"});
  if (!withinQuota("speech", 24)) return json(response, 429, {error: "Rate limit"});
  let text;
  try {
    const body = await readBody(request, speechBodyLimit);
    if (!body) return json(response, 413, {error: "Speech text too long"});
    text = speechText(JSON.parse(body.toString("utf8")));
  } catch {
    return json(response, 400, {error: "Invalid speech request"});
  }
  if (!text) return json(response, 400, {error: "Invalid speech text"});
  try {
    const {bytes, type} = await synthesizeSpeech(text, {elevenLabsKey, elevenLabsVoice, piperUrl});
    response.writeHead(200, {
      "Content-Type": type, "Content-Length": bytes.length, "Cache-Control": "no-store"
    });
    response.end(bytes);
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
  const body = await readBody(request, recordingLimit);
  if (!body) return json(response, 413, {error: "Audio too large"});
  if (!body.length) return json(response, 400, {error: "Empty audio"});
  try {
    return json(response, 200, {text: await transcribeAudio(body, type, key)});
  } catch {
    return json(response, 502, {error: "Transcription unavailable"});
  }
}

const liveServer = new WebSocketServer({noServer: true, maxPayload: liveFrameLimit});

function liveSession(client) {
  client.binaryType = "arraybuffer";
  const upstream = new WebSocket(liveTranscriptionUrl.replace(/^https/, "wss"), {
    headers: {Authorization: `Bearer ${key}`}, handshakeTimeout: 8000
  });
  relayLiveTranscription(client, upstream);
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
