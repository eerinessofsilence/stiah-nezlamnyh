export const speechThreshold = 0.018;

type VoiceStage = 'listening' | 'interrupting' | 'continuing';

const voiceThresholds = {
  listening: { minimum: 0.024, noiseRatio: 1.9 },
  interrupting: { minimum: 0.075, noiseRatio: 4.2 },
  continuing: { minimum: speechThreshold, noiseRatio: 1.4 },
};

export function createLiveVoiceGate() {
  return { noiseFloor: 0, speechMs: 0, interrupting: false };
}

export type LiveVoiceGate = ReturnType<typeof createLiveVoiceGate>;

export function liveVoiceThreshold(gate: LiveVoiceGate, stage: VoiceStage) {
  const { minimum, noiseRatio } = voiceThresholds[stage];
  return Math.max(minimum, gate.noiseFloor * noiseRatio);
}

export function acceptLiveSpeech(gate: LiveVoiceGate, rms: number, durationMs: number, stage: VoiceStage) {
  const speaking = rms > liveVoiceThreshold(gate, stage);
  if (stage === 'continuing') return speaking;
  const interrupting = stage === 'interrupting';
  if (gate.interrupting !== interrupting) {
    gate.interrupting = interrupting;
    gate.speechMs = 0;
  }

  // Learn the room from quiet gaps only, so speech and speaker echo cannot raise the floor.
  if (!interrupting && !speaking && gate.speechMs === 0) {
    const rate = Math.min(1, durationMs / (rms > gate.noiseFloor ? 1000 : 2000));
    gate.noiseFloor += (Math.min(rms, 0.021) - gate.noiseFloor) * rate;
  }
  gate.speechMs = Math.max(0, gate.speechMs + (speaking ? durationMs : -2 * durationMs));
  return speaking && gate.speechMs >= (interrupting ? 380 : 180);
}

export function voiceInputLevel(rms: number, threshold = speechThreshold) {
  return Math.min(1, Math.max(0, (rms - threshold) / 0.12));
}
