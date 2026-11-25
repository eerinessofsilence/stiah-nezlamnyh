import { type AudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { GuideInputFrame } from './form-controls';
import { GuideIcon, GuidePressable, icons } from './guide';
import { useGuideColors } from './theme';

export type RecordingPhase = 'recording' | 'stopping' | 'recorded' | 'transcribing';

const quietWave = Array<number>(32).fill(0);
const recordingStatus = {
  recording: 'Триває запис', stopping: 'Завершую запис…', recorded: 'Запис зупинено', transcribing: 'Розпізнаю запис…',
};

export function AssistantRecordingBar({ recorder, phase, onCancel, onStop, onTranscribe }: {
  recorder: AudioRecorder; phase: RecordingPhase; onCancel: () => void; onStop: () => void; onTranscribe: () => void;
}) {
  const colors = useGuideColors();
  const { durationMillis, isRecording, metering } = useAudioRecorderState(recorder, 100);
  const [wave, setWave] = useState(quietWave);
  const recording = phase === 'recording';
  const transcribing = phase === 'transcribing';
  const canTranscribe = recording || phase === 'recorded';

  useEffect(() => {
    if (!recording || !isRecording) return;
    const level = Math.min(1, Math.max(0, ((metering ?? -54) + 54) / 42));
    setWave(previous => [...previous.slice(1), level]);
  }, [durationMillis, isRecording, metering, recording]);

  return (
    <GuideInputFrame radius={18} style={styles.frame}>
      <GuidePressable accessibilityRole="button" accessibilityLabel="Скасувати запис" onPress={onCancel}
        style={[styles.button, { backgroundColor: colors.surfaceSoft }]}>
        <GuideIcon name={icons.close} size={20} />
      </GuidePressable>
      <View style={styles.wave} accessible accessibilityRole="text" accessibilityLiveRegion={recording ? 'none' : 'polite'}
        accessibilityLabel={recording ? `${recordingStatus.recording}, ${Math.floor(durationMillis / 1000)} с` : recordingStatus[phase]}>
        {wave.map((level, index) => <View key={index} style={[styles.bar, {
          height: 3 + level * 25, opacity: 0.5 + level * 0.5, backgroundColor: colors.accent,
        }]} />)}
      </View>
      <GuidePressable accessibilityRole="button" accessibilityLabel="Зупинити запис" disabled={!recording}
        accessibilityState={{ disabled: !recording }} onPress={onStop}
        style={[styles.button, { backgroundColor: recording ? colors.surfaceSoft : colors.surface }]}>
        <GuideIcon name="stop-fill" color={recording ? colors.foreground : colors.foregroundMuted} size={20} />
      </GuidePressable>
      <GuidePressable accessibilityRole="button" accessibilityLabel="Розпізнати запис" accessibilityHint="Відкриває чернетку для перевірки"
        disabled={!canTranscribe} accessibilityState={{ disabled: !canTranscribe, busy: transcribing }} onPress={onTranscribe}
        focusColor={colors.onFeature} pressedColor={colors.featurePressed}
        style={[styles.button, { backgroundColor: canTranscribe || transcribing ? colors.feature : colors.surfaceMuted }]}>
        {transcribing ? <ActivityIndicator color={colors.onFeature} /> :
          <GuideIcon name="paper-plane-right-fill" color={canTranscribe ? colors.onFeature : colors.foregroundMuted} size={20} />}
      </GuidePressable>
    </GuideInputFrame>
  );
}

const styles = StyleSheet.create({
  frame: { gap: 4, paddingHorizontal: 4, paddingVertical: 4 },
  button: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, minHeight: 32 },
  bar: { flex: 1, borderRadius: 2 },
});
