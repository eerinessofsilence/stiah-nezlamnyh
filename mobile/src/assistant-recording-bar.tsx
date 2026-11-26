import { type AudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';

import { GuideInputFrame, guideInputActionStyle } from './form-controls';
import { GuideIcon, GuidePressable, GuideText, icons } from './guide';
import { useGuideEntrance, useReducedMotion } from './guide-motion';
import { useGuideColors } from './theme';

type RecordingPhase = 'recording' | 'transcribing';

const visibleBars = 32;
const meterInterval = 100;
// One extra bar starts outside the clip and moves into view with the next sample.
const quietWave = Array<number>(visibleBars + 1).fill(0);

export function AssistantRecordingBar({ recorder, phase, onCancel, onTranscribe }: {
  recorder: AudioRecorder; phase: RecordingPhase; onCancel: () => void; onTranscribe: () => void;
}) {
  const colors = useGuideColors();
  const reduced = useReducedMotion();
  const { durationMillis, isRecording, metering } = useAudioRecorderState(recorder, meterInterval);
  const [wave, setWave] = useState(quietWave);
  const [waveWidth, setWaveWidth] = useState(0);
  const [offset] = useState(() => new Animated.Value(0));
  const recording = phase === 'recording';
  const transcribing = phase === 'transcribing';
  const entrance = useGuideEntrance();
  const statusOpacity = useGuideEntrance(transcribing);
  const barWidth = waveWidth / visibleBars;

  useEffect(() => {
    if (!recording || !isRecording || reduced) return;
    const level = Math.min(1, Math.max(0, ((metering ?? -54) + 54) / 42));
    setWave(previous => [...previous.slice(1), level]);
  }, [durationMillis, isRecording, metering, recording, reduced]);

  useLayoutEffect(() => {
    offset.setValue(0);
    if (!recording || reduced || !barWidth || wave === quietWave) return;
    const slide = Animated.timing(offset, {
      toValue: -barWidth, duration: meterInterval, easing: Easing.linear,
      useNativeDriver: true, isInteraction: false,
    });
    slide.start();
    return () => slide.stop();
  }, [barWidth, offset, recording, reduced, wave]);

  return (
    <Animated.View style={{ opacity: entrance }}>
      <GuideInputFrame radius={18} style={styles.frame}>
        <GuidePressable accessibilityRole="button" accessibilityLabel="Скасувати запис" onPress={onCancel}
          style={[guideInputActionStyle, { backgroundColor: colors.surfaceSoft }]}>
          <GuideIcon name={icons.close} size={20} />
        </GuidePressable>
        {recording ? (
          <View style={styles.wave} accessible accessibilityRole="text"
            accessibilityLabel={`Триває запис, ${Math.floor(durationMillis / 1000)} с`}>
            <View style={styles.waveClip} onLayout={({ nativeEvent }) => setWaveWidth(nativeEvent.layout.width)}>
              <Animated.View style={[styles.waveTrack, { width: barWidth * quietWave.length, transform: [{ translateX: offset }] }]}>
                {(reduced ? quietWave : wave).map((level, index) => <View key={index} style={styles.barSlot}>
                  <View style={[styles.bar, {
                    height: 3 + level * 25, opacity: 0.5 + level * 0.5, backgroundColor: colors.accent,
                  }]} />
                </View>)}
              </Animated.View>
            </View>
          </View>
        ) : <Animated.View style={[styles.status, { opacity: statusOpacity }]}>
          <GuideText type="support" announcement>Розпізнаю запис…</GuideText>
        </Animated.View>}
        <GuidePressable accessibilityRole="button" accessibilityLabel="Зупинити й розпізнати запис" disabled={!recording}
          accessibilityState={{ disabled: !recording }} onPress={onTranscribe}
          style={[guideInputActionStyle, { backgroundColor: recording ? colors.surfaceSoft : colors.surfaceMuted }]}>
          <GuideIcon name="stop-fill" color={recording ? colors.foreground : colors.foregroundMuted} size={20} />
        </GuidePressable>
        <GuidePressable accessibilityRole="button" accessibilityLabel="Розпізнати запис" accessibilityHint="Відкриває чернетку для перевірки"
          disabled={!recording} accessibilityState={{ disabled: !recording, busy: transcribing }} onPress={onTranscribe}
          focusColor={colors.onFeature} pressedColor={colors.featurePressed}
          style={[guideInputActionStyle, { backgroundColor: colors.feature }]}>
          {transcribing && !reduced ? <ActivityIndicator color={colors.onFeature} /> :
            <GuideIcon name="paper-plane-right-fill" color={colors.onFeature} size={20} />}
        </GuidePressable>
      </GuideInputFrame>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { gap: 4, paddingHorizontal: 4, paddingVertical: 4 },
  status: { flex: 1, paddingHorizontal: 4 },
  wave: { flex: 1, paddingHorizontal: 4 },
  waveClip: { height: 32, overflow: 'hidden' },
  waveTrack: { height: '100%', flexDirection: 'row' },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: { width: '64%', borderRadius: 2 },
});
