import { hideAsync, preventAutoHideAsync, setOptions } from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';

import { useGuideAppearance, useGuideColors } from './theme';

void preventAutoHideAsync().catch(() => {});
setOptions({ duration: 0 });

export function GuideLaunch({ ready, children }: { ready: boolean; children: ReactNode }) {
  const { darkMode } = useGuideAppearance();
  const { background } = useGuideColors();
  const [laidOut, setLaidOut] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [introFinished, setIntroFinished] = useState(false);
  const [visible, setVisible] = useState(true);
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [coverOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => setReduceMotion(true));
  }, []);

  useEffect(() => {
    if (!laidOut) return;
    void hideAsync().catch(() => {});
  }, [laidOut]);

  useEffect(() => {
    if (!laidOut || !logoReady || reduceMotion === null) return;
    const intro = Animated.timing(logoOpacity, {
      toValue: 1, duration: reduceMotion ? 0 : 320, useNativeDriver: true, isInteraction: false,
    });
    intro.start(({ finished }) => { if (finished) setIntroFinished(true); });
    return () => intro.stop();
  }, [laidOut, logoOpacity, logoReady, reduceMotion]);

  useEffect(() => {
    if (!ready || !introFinished) return;
    const outro = Animated.timing(coverOpacity, {
      toValue: 0, duration: reduceMotion ? 0 : 300, useNativeDriver: true, isInteraction: false,
    });
    outro.start(({ finished }) => { if (finished) setVisible(false); });
    return () => outro.stop();
  }, [coverOpacity, introFinished, ready, reduceMotion]);

  return (
    <View style={[styles.fill, { backgroundColor: background }]} onLayout={() => setLaidOut(true)}>
      <View style={styles.fill} pointerEvents={visible ? 'none' : 'auto'}
        accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {visible && (
        <Animated.View style={[styles.cover, { backgroundColor: background, opacity: coverOpacity }]}>
          <StatusBar style={darkMode ? 'light' : 'dark'} />
          <Animated.Image
            source={darkMode ? require('../assets/brand-logo-dark.png') : require('../assets/brand-logo.png')}
            style={[styles.logo, { opacity: logoOpacity }]}
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
