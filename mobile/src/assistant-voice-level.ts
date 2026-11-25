export const speechThreshold = 0.018;

export function voiceInputLevel(rms: number) {
  return Math.min(1, Math.max(0, (rms - speechThreshold) / 0.12));
}
