import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { Animated, type GestureResponderEvent, type HostInstance, PanResponder, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import type { useAssistantAudio } from './assistant-audio';
import { GuideButton, guideContentInset, guideContentMaxWidth, GuideIconButton, GuidePressable, GuideText } from './guide';
import { motion, useGuideEntrance, useGuideTransition, useReducedMotion } from './guide-motion';
import { useGuideAppearance, useGuideColors } from './theme';

type VoiceControls = Pick<ReturnType<typeof useAssistantAudio>, 'phase' | 'error' | 'micMuted' |
  'inputLevel' | 'replyPulse' | 'toggleMic' | 'stopSpeech'>;

const statusText = {
  idle: '', permission: 'Доступ до мікрофона', recording: '', transcribing: 'Розпізнаю…',
  connecting: 'Підключаюся…', listening: '',
  thinking: 'Шукаю відповідь…', speaking: '',
};

const waveTexture = require('../assets/voice-ribbon.png');
const orbDragStart = 8;
const orbPullLimit = 150;
const ribbons = [
  { tilt: -14, offset: -0.06, mirror: 1, drift: -0.07, opacity: 0.52 },
  { tilt: 12, offset: 0.06, mirror: -1, drift: 0.10, opacity: 0.70 },
  { tilt: -4, offset: 0, mirror: 1, drift: 0.04, opacity: 0.90 },
] as const;

export function AssistantVoiceView({ audio, compact, orbRef, onToggle, onEnd }: {
  audio: VoiceControls; compact: boolean; orbRef: Ref<HostInstance>; onToggle: () => void; onEnd: () => void;
}) {
  const { phase, micMuted, inputLevel, replyPulse } = audio;
  const colors = useGuideColors();
  const reduced = useReducedMotion();
  const replying = phase === 'speaking';
  const micAvailable = phase === 'listening' || replying;
  const status = statusText[phase];
  const entrance = useGuideEntrance();
  const statusOpacity = useGuideEntrance(Boolean(status && !audio.error));
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const [endButtonHeight, setEndButtonHeight] = useState(48);
  const [pull] = useState(() => new Animated.Value(0));
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const size = compact ? 60 : Math.min(196, width * 0.46, Math.max(72, (height || 360) * 0.42));
  const flex = compact ? 0 : 1;
  const direction = compact ? -1 : 1;
  const translateY = pull.interpolate({
    inputRange: [0, 56, orbPullLimit], outputRange: [0, direction * 36, direction * 60], extrapolateRight: 'clamp',
  });
  const scale = pull.interpolate({
    inputRange: [0, 56, orbPullLimit], outputRange: compact ? [1, 1.20, 1.30] : [1, 0.84, 0.73], extrapolateRight: 'clamp',
  });

  useEffect(() => {
    if (reduced) pull.setValue(0);
    return () => pull.stopAnimation();
  }, [pull, reduced]);

  const settle = useCallback(() => {
    if (reduced) return;
    Animated.spring(pull, {
      toValue: 0, stiffness: 225, damping: 14, mass: 0.85, useNativeDriver: true, isInteraction: false,
    }).start();
  }, [pull, reduced]);

  const switchMode = useCallback((distance = 48) => {
    if (!reduced) pull.setValue(Math.min(distance, orbPullLimit));
    onToggle();
    settle();
  }, [onToggle, pull, reduced, settle]);

  const displacement = useCallback(({ nativeEvent }: GestureResponderEvent) => {
    const origin = touchOrigin.current;
    return origin ? { dx: nativeEvent.pageX - origin.x, dy: direction * (nativeEvent.pageY - origin.y) } : { dx: 0, dy: 0 };
  }, [direction]);

  const finishPull = useCallback((dx: number, dy: number) => {
    touchOrigin.current = null;
    if (dy >= 36 && dy > Math.abs(dx)) switchMode(Math.max(48, dy));
    else settle();
  }, [settle, switchMode]);

  const gesture = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: ({ nativeEvent }) => {
      touchOrigin.current = { x: nativeEvent.pageX, y: nativeEvent.pageY };
      return false;
    },
    onMoveShouldSetPanResponderCapture: event => {
      const { dx, dy } = displacement(event);
      return dy > Math.max(orbDragStart, Math.abs(dx));
    },
    onPanResponderGrant: () => pull.stopAnimation(),
    onPanResponderMove: event => {
      if (!reduced) pull.setValue(Math.min(orbPullLimit, Math.max(0, displacement(event).dy)));
    },
    onPanResponderRelease: event => {
      const { dx, dy } = displacement(event);
      finishPull(dx, dy);
    },
    onPanResponderTerminate: () => finishPull(0, 0),
  }), [displacement, finishPull, pull, reduced]);

  return (
    <SafeAreaView edges={{ top: !compact, bottom: Platform.OS === 'ios', left: true, right: true }}
      style={{ flex, backgroundColor: colors.background }}>
      <Animated.View onAccessibilityEscape={compact ? onEnd : onToggle} style={[styles.page, { flex, opacity: entrance }]}
        onLayout={({ nativeEvent: { layout } }) => { if (!compact) setHeight(layout.height); }}>
        {!compact && <View style={styles.header}>
          <GuideText type="sheetTitle" style={styles.title}>Голосова розмова</GuideText>
          <GuideIconButton icon="chats" label="Показати чат" surface="background" onPress={() => switchMode()} />
        </View>}
        <View style={[styles.activity, { flex }]}>
          <View style={styles.orbGesture} {...gesture.panHandlers}>
            <GuidePressable ref={orbRef} accessibilityRole="button" accessibilityState={{ expanded: !compact }}
              accessibilityLabel={compact ? 'Розгорнути голосову розмову' : 'Показати чат і продовжити розмову'}
              accessibilityValue={{ text: replying ? 'Відтворюю відповідь' : micMuted ? 'Мікрофон вимкнено' : status || undefined }}
              onPress={event => {
                const { dx, dy } = displacement(event);
                if (Math.hypot(dx, dy) > orbDragStart) finishPull(dx, dy);
                else {
                  touchOrigin.current = null;
                  switchMode();
                }
              }}
              style={{ borderRadius: (size + 16) / 2 }}>
              <Animated.View pointerEvents="none" style={{ transform: [{ translateY }, { scale }] }}>
                <VoiceOrb size={size} phase={phase} muted={micMuted} inputLevel={inputLevel} replyPulse={replyPulse} />
              </Animated.View>
            </GuidePressable>
          </View>
          {!!status && !audio.error && <Animated.View style={{ opacity: statusOpacity }}>
            <GuideText type="support" tone="foregroundMuted" style={styles.centered} announcement>{status}</GuideText>
          </Animated.View>}
          {!!audio.error && <GuideText type="support" style={styles.centered} announcement>{audio.error}</GuideText>}
          {replying && !compact && <GuideButton label="Перервати відповідь" onPress={audio.stopSpeech} style={styles.interrupt} />}
        </View>
        <View style={styles.footer}>
          {replying && compact && <GuideIconButton icon="stop-fill" label="Перервати відповідь" onPress={audio.stopSpeech} />}
          <GuideButton label="Завершити розмову" variant="primary" onPress={onEnd} style={styles.end}
            onLayout={({ nativeEvent }) => setEndButtonHeight(nativeEvent.layout.height)} />
          <GuideIconButton size={endButtonHeight} icon="microphone" alternateIcon={{ name: 'microphone-slash', active: micMuted }}
            label={micMuted ? 'Увімкнути мікрофон' : 'Вимкнути мікрофон'} disabled={!micAvailable} onPress={() => void audio.toggleMic()} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

function VoiceOrb({ size, phase, muted, inputLevel, replyPulse }: {
  size: number; phase: VoiceControls['phase']; muted: boolean; inputLevel: Animated.Value; replyPulse: Animated.Value;
}) {
  const colors = useGuideColors();
  const { darkMode } = useGuideAppearance();
  const reduced = useReducedMotion();
  const [drift] = useState(() => new Animated.Value(0));
  const replying = phase === 'speaking';
  const listening = phase === 'listening';
  const processing = phase === 'connecting' || phase === 'transcribing' || phase === 'thinking';
  const drifting = !reduced && (replying || !muted && processing);
  const driftDuration = replying ? 1050 : 1900;

  useEffect(() => {
    if (!drifting) return;
    const animation = Animated.loop(Animated.sequence([1, 0].map(toValue => Animated.timing(drift, {
      toValue, duration: driftDuration, useNativeDriver: true, isInteraction: false, easing: motion.easeInOut,
    }))));
    animation.start();
    return () => { animation.stop(); drift.setValue(0); };
  }, [drift, driftDuration, drifting]);

  const level = replying ? replyPulse : inputLevel;
  const reactive = !reduced && (replying || listening && !muted);
  const angle = useGuideTransition(replying ? 15 : processing ? -19 : 0);
  const base = muted ? colors.voiceOrbMutedBase : colors.feature;
  const shade = muted ? colors.voiceOrbMutedShade : colors.featurePressed;
  const pale = muted ? colors.voiceOrbMutedLight : darkMode ? colors.accent : colors.surfaceMuted;
  const highlight = muted ? pale : colors.onFeature;
  const glow = muted ? shade : colors.button;
  const waveColors = [glow, pale, highlight];
  // Render the light behind and in front of the sheet so it reads as a glass sphere.
  const interior = [
    `radial-gradient(ellipse 68% 40% at 46% 53%, ${glow}${replying ? '87' : '55'}, ${glow}00 100%)`,
    `radial-gradient(ellipse 64% 69% at 33% 24%, ${pale}22, ${pale}00 100%)`,
    `linear-gradient(145deg, ${shade}, ${base} 76%, ${shade})`,
  ].join(', ');
  const glass = [
    `radial-gradient(ellipse 29% 12% at 26% 21%, ${highlight}30, ${highlight}00 100%)`,
    `radial-gradient(ellipse 22% 36% at 99% 56%, ${pale}37, ${pale}00 100%)`,
    `radial-gradient(circle closest-side, ${pale}00 72%, ${pale}11 88%, ${pale}58 98%, ${pale}33 100%)`,
  ].join(', ');

  return (
    <View style={[styles.orbFrame, { width: size + 16, height: size + 16 }]}>
      <View pointerEvents="none" style={[styles.sphere, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: base, borderColor: `${pale}44`,
      }]}>
        <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: interior }]} />
        {ribbons.map((ribbon, index) => {
          const tip = Animated.add(angle, ribbon.tilt).interpolate({ inputRange: [-50, 50], outputRange: ['-50deg', '50deg'] });
          const offset = size * ribbon.offset;
          const waveShift = reactive ? level.interpolate({
            inputRange: [0, 1], outputRange: [offset, offset * (replying ? 1.35 : 2.05)], extrapolate: 'clamp',
          }) : offset;
          const heightScale = reactive ? level.interpolate({
            inputRange: [0, 1], outputRange: [replying ? 0.89 : 0.58, replying ? 1.43 : 1.36], extrapolate: 'clamp',
          }) : 0.72;
          const driftDistance = size * ribbon.drift * (replying ? -1.7 : 1);
          const brightness = reactive ? level.interpolate({
            inputRange: [0, 1], outputRange: [ribbon.opacity * 0.76, ribbon.opacity], extrapolate: 'clamp',
          }) : ribbon.opacity * 0.85;
          return <Animated.Image key={index} source={waveTexture} resizeMode="stretch" fadeDuration={0}
            accessible={false} style={[styles.ribbon, {
              tintColor: waveColors[index], opacity: brightness,
              transform: [
                { translateX: Animated.multiply(drift, driftDistance) },
                { translateY: waveShift }, { rotate: tip },
                { scaleX: ribbon.mirror * (replying ? -1 : 1) }, { scaleY: heightScale },
              ],
            }]} />;
        })}
        <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: glass }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: guideContentMaxWidth, width: '100%', alignSelf: 'center', gap: 8, paddingHorizontal: guideContentInset, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12 },
  title: { flex: 1 },
  activity: { justifyContent: 'center', gap: 4 },
  orbGesture: { alignSelf: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  end: { flex: 1, minWidth: 0 },
  orbFrame: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  sphere: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  ribbon: { position: 'absolute', left: '-8%', top: '11%', width: '116%', height: '78%' },
  centered: { textAlign: 'center' },
  interrupt: { alignSelf: 'center' },
});
