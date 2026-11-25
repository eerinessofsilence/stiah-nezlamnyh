import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GuideBackButton, GuideIcon, GuidePanel, GuideScreen, GuideText } from '../guide';
import { useGuideColors } from '../theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useGuideColors();

  return (
    <GuideScreen title="Сповіщення"
      titleAction={<GuideBackButton label="Назад" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />}>
      <GuidePanel style={styles.emptyState}>
        <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
          <GuideIcon name="bell" size={22} />
        </View>
        <GuideText type="section" style={styles.copy}>Сповіщень поки немає</GuideText>
        <GuideText type="support" tone="foregroundMuted" style={styles.copy}>
          Тут з’являтимуться повідомлення й опитування від гіда.
        </GuideText>
      </GuidePanel>
    </GuideScreen>
  );
}

const styles = StyleSheet.create({
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  copy: { textAlign: 'center' },
});
