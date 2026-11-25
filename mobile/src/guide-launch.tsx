import { hideAsync, preventAutoHideAsync, setOptions } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, type ReactNode, useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { GuideLogo } from './guide-logo';
import { motion, useMotionPreference } from './guide-motion';
import { useGuideAppearance, useGuideColors } from './theme';

void preventAutoHideAsync().catch(() => {});
setOptions({ duration: 0 });

export const GuideContentReady = createContext<(() => void) | null>(null);

export function GuideLaunch({ ready, children }: { ready: boolean; children: ReactNode }) {
  const { darkMode } = useGuideAppearance();
  const { background } = useGuideColors();
  const [laidOut, setLaidOut] = useState(false);
  const [contentLaidOut, setContentLaidOut] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const reduceMotion = useMotionPreference();
  const [animationFinished, setAnimationFinished] = useState(false);
  const [visible, setVisible] = useState(true);
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [reportReady] = useState(() => () => setContentLaidOut(true));

  useEffect(() => {
    if (!laidOut) return;
    void hideAsync().catch(() => {});
  }, [laidOut]);

  useEffect(() => {
    if (!visible || !laidOut || !logoReady || reduceMotion !== false || animationFinished) return;
    logoOpacity.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(logoOpacity, {
        toValue: 1, duration: motion.logoFadeIn, useNativeDriver: true, isInteraction: false,
      }),
      Animated.delay(motion.logoHold),
      Animated.timing(logoOpacity, {
        toValue: 0, duration: motion.logoFadeOut, useNativeDriver: true, isInteraction: false,
      }),
    ]);
    animation.start(({ finished }) => { if (finished) setAnimationFinished(true); });
    return () => animation.stop();
  }, [animationFinished, laidOut, logoOpacity, logoReady, reduceMotion, visible]);

  useEffect(() => {
    if (contentLaidOut && (animationFinished || reduceMotion === true)) setVisible(false);
  }, [animationFinished, contentLaidOut, reduceMotion]);

  return (
    <View style={[styles.fill, { backgroundColor: background }]} onLayout={() => setLaidOut(true)}>
      {ready && <View style={styles.fill} pointerEvents={visible ? 'none' : 'auto'}
        accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
        <GuideContentReady.Provider value={visible ? reportReady : null}>{children}</GuideContentReady.Provider>
      </View>}
      {visible && (
        <View style={[styles.cover, { backgroundColor: background }]}>
          <StatusBar style={darkMode ? 'light' : 'dark'} />
          <GuideLogo
            style={{ opacity: reduceMotion === true ? 1 : logoOpacity }}
            onLoadEnd={() => setLogoReady(true)}
            accessible={false}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
});
