import type { ComponentProps } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { useGuideAppearance } from './theme';

export function GuideLogo({ accessible = true, onLoadEnd, style }: Pick<ComponentProps<typeof Animated.Image>,
  'accessible' | 'onLoadEnd' | 'style'>) {
  const { darkMode } = useGuideAppearance();
  return <Animated.Image
    source={darkMode ? require('../assets/brand-logo-dark.png') : require('../assets/brand-logo.png')}
    style={[styles.logo, style]} resizeMode="contain" fadeDuration={0} onLoadEnd={onLoadEnd}
    accessible={accessible} accessibilityRole="image" accessibilityLabel="Гід: Стяг незламних" accessibilityLanguage="uk" />;
}

const styles = StyleSheet.create({
  logo: { alignSelf: 'center', width: '100%', maxWidth: 272, aspectRatio: 907 / 224 },
});
