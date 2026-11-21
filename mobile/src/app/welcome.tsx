import { Redirect, useRouter } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuideButton, guideContentInset, guideContentMaxWidth, GuideScreen, GuideText } from '../guide';
import { useGuideState } from '../guide-state';
import { useGuideColors } from '../theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useGuideColors();
  const { profile } = useGuideState();

  if (profile) return <Redirect href="/(tabs)" />;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <GuideScreen showBrand title="Вітаємо!">
        <GuideText tone="foregroundMuted">Гід для ветеранів, ветеранок і родин загиблих захисників та захисниць України.</GuideText>
        <View style={[styles.poster, { backgroundColor: colors.surfaceMuted }]}>
          <Image source={require('../../assets/welcome.webp')} style={styles.artwork} resizeMode="cover" accessible={false} />
        </View>
      </GuideScreen>
      <SafeAreaView edges={['left', 'right', 'bottom']}>
        <View style={styles.footer}>
          <GuideButton label="Продовжити" variant="primary" fullWidth onPress={() => router.replace('/onboarding')} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  poster: { width: '100%', aspectRatio: 4 / 5, alignSelf: 'center', marginTop: 8, borderRadius: 24, overflow: 'hidden' },
  artwork: { width: '100%', height: '100%' },
  footer: { width: '100%', maxWidth: guideContentMaxWidth, alignSelf: 'center', paddingHorizontal: guideContentInset, paddingVertical: 8 },
});
