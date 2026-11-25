import { useNavigation, type NativeStackNavigationProp } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, type TextInstance, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { useAssistantAudio } from './assistant-audio';
import { GuideButton, guideContentMaxWidth, GuideIconButton, GuidePanel, GuideText, icons } from './guide';
import { focusGuideControl, motion, useReducedMotion } from './guide-motion';
import { useGuideColors } from './theme';

type VoiceControls = Pick<ReturnType<typeof useAssistantAudio>, 'phase' | 'error' | 'micMuted' |
  'inputLevel' | 'replyPulse' | 'confirmation' | 'confirmTranscript' | 'cancel' | 'toggleMic' | 'stopSpeech'>;

const statusText = {
  idle: '', permission: 'Доступ до мікрофона', recording: '', stopping: '', recorded: '', transcribing: 'Розпізнаю…',
  connecting: 'Підключаюся…', listening: '', confirming: 'Перевірте розпізнаний текст',
  thinking: 'Шукаю відповідь…', speaking: '',
};

export function AssistantVoiceView({ audio }: { audio: VoiceControls }) {
  const { phase, micMuted, inputLevel, replyPulse } = audio;
  const replying = phase === 'speaking';
  const micAvailable = phase === 'listening' || replying;
  const status = statusText[phase];
  const { bottom, left, right } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const heading = useRef<TextInstance>(null);
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [height, setHeight] = useState(0);
  const size = Math.min(196, width * 0.46, Math.max(72, (height || 280) * 0.35));
  const horizontal = { paddingLeft: 20 + left, paddingRight: 20 + right };

  useEffect(() => navigation.addListener('transitionEnd', ({ data }) => {
    if (!data.closing && navigation.isFocused()) focusGuideControl(heading.current);
  }), [navigation]);

  return (
    <View accessibilityViewIsModal onAccessibilityEscape={audio.cancel} style={styles.page}
      onLayout={({ nativeEvent: { layout } }) => setHeight(layout.height)}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.body, horizontal]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <GuideText type="sheetTitle" textRef={heading} style={styles.title}>Голосова розмова</GuideText>
          <GuideIconButton icon={icons.close} label="Закрити голосову розмову" surface="background" onPress={audio.cancel} />
        </View>
        <View style={styles.activity}>
          <VoiceOrb size={size} listening={phase === 'listening' && !micMuted} replying={replying} muted={micMuted}
            inputLevel={inputLevel} replyPulse={replyPulse} />
          {!!status && <GuideText type="support" tone="foregroundMuted" style={styles.centered} announcement>{status}</GuideText>}
          {!!audio.error && <GuideText type="support" style={styles.centered} announcement>{audio.error}</GuideText>}
          {phase === 'confirming' && <GuidePanel>
            <GuideText>{audio.confirmation}</GuideText>
            <GuideButton label="Підтвердити" variant="primary" onPress={() => audio.confirmTranscript(false)} />
            <GuideButton label="Виправити в чаті" onPress={() => audio.confirmTranscript(true)} />
          </GuidePanel>}
          {replying && <GuideButton label="Перервати відповідь" onPress={audio.stopSpeech} style={styles.interrupt} />}
        </View>
      </ScrollView>
      <View style={[styles.footer, horizontal, { paddingBottom: Math.max(12, bottom) }]}>
        <GuideButton label="Завершити розмову" variant="primary" onPress={audio.cancel} style={styles.end} />
        <GuideIconButton icon={micMuted ? 'microphone-slash' : 'microphone'}
          label={micMuted ? 'Увімкнути мікрофон' : 'Вимкнути мікрофон'} disabled={!micAvailable} onPress={() => void audio.toggleMic()} />
      </View>
    </View>
  );
}

const barHeights = [0.28, 0.49, 0.7, 0.86, 0.7, 0.49, 0.28];
const replyHeights = [0.38, 0.64, 0.83, 0.5, 0.75, 0.6, 0.34];

function VoiceOrb({ size, listening, replying, muted, inputLevel, replyPulse }: {
  size: number; listening: boolean; replying: boolean; muted: boolean; inputLevel: Animated.Value; replyPulse: Animated.Value;
}) {
  const colors = useGuideColors();
  const reduced = useReducedMotion();
  const [orbit] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!replying || reduced) return;
    const rotation = Animated.loop(Animated.timing(orbit, {
      toValue: 1, duration: 6400, useNativeDriver: true, isInteraction: false,
      easing: motion.easeInOut,
    }));
    rotation.start();
    return () => { rotation.stop(); orbit.setValue(0); };
  }, [orbit, replying, reduced]);

  const level = replying ? replyPulse : inputLevel;
  const reactive = !reduced && (listening || replying);
  const ringScale = reactive ? level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.075] }) : 1;
  const outerSize = size + 8;
  const innerSize = size * 0.72;
  const tracks = replying ? replyHeights : barHeights;

  return (
    <View accessible={replying} accessibilityRole={replying ? 'image' : undefined}
      accessibilityLabel={replying ? 'Відтворюю відповідь' : undefined}
      style={[styles.orbFrame, { width: size + 24, height: size + 24 }]}>
      <View pointerEvents="none" style={[styles.disc, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: replying ? colors.surfaceMuted : colors.surfaceSoft,
      }]} />
      <View pointerEvents="none" style={[styles.ring, {
        width: innerSize, height: innerSize, borderRadius: innerSize / 2,
        borderColor: `${colors.accent}40`,
      }]} />
      <Animated.View pointerEvents="none" style={[styles.ring, {
        width: outerSize, height: outerSize, borderRadius: outerSize / 2,
        borderColor: replying ? colors.accent : `${colors.accent}66`,
        transform: [{ scale: ringScale }],
      }]}>
        {replying && <Animated.View style={[StyleSheet.absoluteFill, {
          transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }]}>
          <View style={[styles.orbitDot, { backgroundColor: colors.accent }]} />
          <View style={[styles.orbitDot, styles.oppositeDot, { backgroundColor: colors.accent }]} />
        </Animated.View>}
      </Animated.View>
      <View pointerEvents="none" style={[styles.bars, { gap: size * 0.036 }]}>
        {tracks.map((bar, index) => {
          const scaleY = reactive ? level.interpolate({
            inputRange: [0, 1], outputRange: [0.48, index % 2 === 0 ? 1.2 : 1.5],
          }) : muted && !replying ? 0.18 : 0.68;
          return <Animated.View key={index} style={{ width: Math.max(3, size * 0.028), height: size * bar * 0.47,
            borderRadius: 8, backgroundColor: colors.accent, transform: [{ scaleY }] }} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, maxWidth: guideContentMaxWidth, width: '100%', alignSelf: 'center', gap: 8 },
  scroll: { flex: 1 },
  body: { flexGrow: 1, gap: 4, paddingTop: Platform.OS === 'ios' ? 20 : 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1 },
  activity: { flexGrow: 1, justifyContent: 'center', gap: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  end: { flex: 1, minWidth: 0 },
  orbFrame: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1 },
  disc: { position: 'absolute' },
  bars: { flexDirection: 'row', alignItems: 'center' },
  orbitDot: { position: 'absolute', top: -3, alignSelf: 'center', width: 7, height: 7, borderRadius: 4 },
  oppositeDot: { top: undefined, bottom: -3 },
  centered: { textAlign: 'center' },
  interrupt: { alignSelf: 'center' },
});
