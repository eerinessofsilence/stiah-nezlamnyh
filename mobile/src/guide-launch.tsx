import { hideAsync, preventAutoHideAsync, setOptions } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { createContext, type ReactNode, useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

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
  const [introFinished, setIntroFinished] = useState(false);
  const [visible, setVisible] = useState(true);
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [coverOpacity] = useState(() => new Animated.Value(1));
  const [reportReady] = useState(() => () => setContentLaidOut(true));

  useEffect(() => {
    if (!laidOut) return;
    void hideAsync().catch(() => {});
  }, [laidOut]);

  useEffect(() => {
    if (!visible || !laidOut || !logoReady || reduceMotion === null) return;
    if (reduceMotion) {
      logoOpacity.setValue(1);
      setIntroFinished(true);
      return;
    }
    const intro = Animated.timing(logoOpacity, {
      toValue: 1, duration: motion.logo, useNativeDriver: true, isInteraction: false,
    });
    intro.start(({ finished }) => { if (finished) setIntroFinished(true); });
    return () => intro.stop();
  }, [laidOut, logoOpacity, logoReady, reduceMotion, visible]);

  useEffect(() => {
    if (!visible || !contentLaidOut) return;
    if (reduceMotion !== false) {
      setVisible(false);
      return;
    }
    if (!introFinished) return;
    const outro = Animated.timing(coverOpacity, {
      toValue: 0, duration: motion.splash, useNativeDriver: true, isInteraction: false,
    });
    outro.start(({ finished }) => { if (finished) setVisible(false); });
    return () => outro.stop();
  }, [contentLaidOut, coverOpacity, introFinished, reduceMotion, visible]);

  return (
    <View style={[styles.fill, { backgroundColor: background }]} onLayout={() => setLaidOut(true)}>
      {ready && <View style={styles.fill} pointerEvents={visible ? 'none' : 'auto'}
        accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
        <GuideContentReady.Provider value={visible ? reportReady : null}>{children}</GuideContentReady.Provider>
      </View>}
      {visible && (
        <Animated.View style={[styles.cover, { backgroundColor: background, opacity: coverOpacity }]}>
          <StatusBar style={darkMode ? 'light' : 'dark'} />
          <Animated.Image
            source={darkMode ? require('../assets/brand-logo-dark.png') : require('../assets/brand-logo.png')}
            style={[styles.logo, { opacity: reduceMotion === true ? 1 : logoOpacity }]}
            resizeMode="contain"
            fadeDuration={0}
            onLoadEnd={() => setLogoReady(true)}
            accessible={false}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  cover: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logo: { width: '100%', maxWidth: 272, aspectRatio: 907 / 224 },
});
