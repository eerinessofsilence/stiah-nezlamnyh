const audioTypes = {"audio/mp4": "m4a", "audio/m4a": "m4a", "audio/aac": "aac", "audio/wav": "wav"};
const languages = ["uk", "ru"];
const keywords = ["УБД", "СЗЧ", "ВЛК", "ЕКОПФО", "ТЦК та СП", "ПФУ", "ЦНАП", "Одеса", "в Одесі", "в Одессе"];
const liveTranscriptionUrl = "https://api.openai.com/v1/realtime?intent=transcription";
const recordingLimit = 2 * 1024 * 1024;
const liveFrameLimit = 32 * 1024;
const bytesPerSecond = 24000 * 2;
const speechBodyLimit = 32 * 1024;
const speechAudioLimit = 12 * 1024 * 1024;
const defaultVoice = "eLDtXX7z65CuLasDRxrP";

function speechText(payload) {
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  return text && text.length <= 8000 ? text : null;
}

async function synthesizeSpeech(text, {elevenLabsKey, elevenLabsVoice, piperUrl}) {
  const url = elevenLabsKey ?
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(elevenLabsVoice || defaultVoice)}?output_format=mp3_44100_128` : piperUrl;
  const payload = elevenLabsKey ? {text, model_id: "eleven_flash_v2_5", language_code: "uk"} : {text, length_scale: 1.05};
  const response = await fetch(url, {
    method: "POST", headers: {"Content-Type": "application/json", ...(elevenLabsKey && {"xi-api-key": elevenLabsKey})},
    redirect: "manual", body: JSON.stringify(payload), signal: AbortSignal.timeout(14000)
  });
  if (!response.ok || Number(response.headers.get("content-length")) > speechAudioLimit) throw new Error("Speech unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length <= 44 || bytes.length > speechAudioLimit) throw new Error("Invalid speech audio");
  const view = new DataView(bytes.buffer);
  // Piper can return a WAV with a non-audio Content-Type.
  const valid = elevenLabsKey ? (view.getUint32(0) >>> 8) === 0x494433 || (view.getUint16(0) & 0xffe0) === 0xffe0 :
    view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57415645;
  if (!valid) throw new Error("Invalid speech audio");
  return {bytes, type: elevenLabsKey ? "audio/mpeg" : "audio/wav"};
}

function normalizeVoiceRecording(bytes) {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = 0x52494646;
  const wave = 0x57415645;
  const format = 0x666d7420;
  const data = 0x64617461;
  if (view.getUint32(0) !== riff || view.getUint32(8) !== wave) return null;
  let validFormat = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = view.getUint32(offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > bytes.length) return null;
    if (kind === format) {
      validFormat = size >= 16 && view.getUint16(start, true) === 1 && view.getUint16(start + 2, true) === 1 &&
        view.getUint32(start + 4, true) === 16000 && view.getUint16(start + 14, true) === 16;
    } else if (kind === data) {
      if (!validFormat || !size || size % 2) return null;
      // Send canonical PCM so the public byte limit also bounds paid audio duration.
      const length = Math.min(size, 16000 * 2 * 60);
      const wav = new Uint8Array(44 + length);
      const header = new DataView(wav.buffer);
      header.setUint32(0, riff);
      header.setUint32(4, wav.length - 8, true);
      header.setUint32(8, wave);
      header.setUint32(12, format);
      header.setUint32(16, 16, true);
      header.setUint16(20, 1, true);
      header.setUint16(22, 1, true);
      header.setUint32(24, 16000, true);
      header.setUint32(28, 32000, true);
      header.setUint16(32, 2, true);
      header.setUint16(34, 16, true);
      header.setUint32(36, data);
      header.setUint32(40, length, true);
      wav.set(bytes.subarray(start, start + length), 44);
      return wav;
    }
    offset = start + size + size % 2;
  }
  return null;
}

async function transcribeAudio(body, type, key) {
  const form = new FormData();
  form.set("file", new Blob([body], {type}), "question." + audioTypes[type]);
  form.set("model", "gpt-transcribe");
  form.set("prompt", "Питання до ветеранського гіда українською або російською. Можливі короткі уточнення, адреси та абревіатури.");
  for (const language of languages) form.append("languages[]", language);
  for (const keyword of keywords) form.append("keywords[]", keyword);
  const result = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: {Authorization: `Bearer ${key}`}, body: form, signal: AbortSignal.timeout(18000)
  });
  if (!result.ok) throw new Error("Transcription unavailable");
  const {text} = await result.json();
  if (typeof text !== "string") throw new Error("Invalid transcription");
  return text.trim();
}

function relayLiveTranscription(client, upstream) {
  const startedAt = Date.now();
  let ready = false;
  let totalBytes = 0;
  let turnBytes = 0;
  let pending = false;
  let itemId;
  let idleTimer;
  let resultTimer;
  let closed = false;
  const send = (socket, event) => {
    if (socket.readyState === 1) socket.send(JSON.stringify(event));
  };
  const close = (code = 1011) => {
    if (closed) return;
    closed = true;
    clearTimeout(sessionTimer);
    clearTimeout(idleTimer);
    clearTimeout(resultTimer);
    if (client.readyState === 1) client.close(code);
    if (typeof upstream.terminate === "function") upstream.terminate();
    else if (upstream.readyState === 1) upstream.close();
  };
  const sessionTimer = setTimeout(() => close(1000), 5 * 60_000);
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => close(1000), 45_000);
  };
  resetIdle();
  client.addEventListener("close", () => close(1000));
  client.addEventListener("error", () => close());
  upstream.addEventListener("error", () => close());
  upstream.addEventListener("close", () => close());
  upstream.addEventListener("message", ({data}) => {
    let event;
    try { event = JSON.parse(data); } catch { return close(); }
    if (!event || typeof event !== "object") return close();
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
  client.addEventListener("message", ({data}) => {
    if (closed) return;
    try {
      if (!ready) return close(1008);
      if (data === "keepalive") return resetIdle();
      if (pending) return close(1008);
      if (data instanceof ArrayBuffer) {
        const size = data.byteLength;
        if (!size || size > liveFrameLimit || size % 2 || upstream.bufferedAmount > 256 * 1024) return close(1008);
        totalBytes += size;
        turnBytes += size;
        const maxBytes = bytesPerSecond * Math.min(300, (Date.now() - startedAt) / 1000 + 5);
        if (totalBytes > maxBytes || turnBytes > bytesPerSecond * 60) return close(1008);
        resetIdle();
        const audio = btoa(String.fromCharCode(...new Uint8Array(data)));
        send(upstream, {type: "input_audio_buffer.append", audio});
      } else if (data === "commit" && turnBytes >= 4800) {
        pending = true;
        turnBytes = 0;
        resultTimer = setTimeout(() => close(), 12000);
        send(upstream, {type: "input_audio_buffer.commit"});
      } else if (data === "clear") {
        turnBytes = 0;
        send(upstream, {type: "input_audio_buffer.clear"});
      } else close(1008);
    } catch {
      close();
    }
  });
  const configure = () => send(upstream, {
    type: "session.update", session: {type: "transcription", audio: {input: {
      format: {type: "audio/pcm", rate: 24000}, turn_detection: null,
      transcription: {model: "gpt-live-transcribe", languages, keywords}
    }}}
  });
  if (upstream.readyState === 1) configure();
  else upstream.addEventListener("open", configure);
}

module.exports = {
  audioTypes, recordingLimit, liveFrameLimit, liveTranscriptionUrl, normalizeVoiceRecording, transcribeAudio, relayLiveTranscription,
  speechBodyLimit, speechText, synthesizeSpeech,
};
