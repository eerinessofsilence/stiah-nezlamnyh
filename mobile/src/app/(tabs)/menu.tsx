import Constants from 'expo-constants';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { GuideIcon, GuidePanel, GuidePressable, GuideScreen, GuideText, icons } from '../../guide';
import { GuideSwitch } from '../../form-controls';
import { useGuideAppearance, useGuideColors } from '../../theme';

const version = Constants.expoConfig?.version;

export default function MenuScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { darkMode, setPreference } = useGuideAppearance();

  if (section === 'contacts') return <Redirect href="/contacts" />;
  if (section === 'about') return <Redirect href="/about" />;

  return (
    <GuideScreen title="Меню">
      {version && <GuideText type="meta" tone="foregroundMuted">Версія {version}</GuideText>}
      <GuidePanel style={styles.group}>
        <MenuLink label="Контакти" icon="users" onPress={() => router.navigate('/contacts')} />
        <MenuLink label="Про гід" icon="info" onPress={() => router.navigate('/about')} divided />
      </GuidePanel>
      <GuidePanel style={[styles.group, styles.row]}>
        <GuideText type="item" style={styles.label}>Темна тема</GuideText>
        <GuideSwitch accessibilityLabel="Темна тема" value={darkMode}
          onValueChange={enabled => setPreference(enabled ? 'dark' : 'light')} />
      </GuidePanel>
    </GuideScreen>
  );
}

function MenuLink({ label, icon, onPress, divided = false }: {
  label: string; icon: 'users' | 'info'; onPress: () => void; divided?: boolean;
}) {
  const colors = useGuideColors();
  return (
    <GuidePressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress}
      style={[styles.row, divided && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <GuideIcon name={icon} size={22} />
      <GuideText type="item" style={styles.label}>{label}</GuideText>
      <GuideIcon name={icons.next} color={colors.foregroundMuted} size={18} />
    </GuidePressable>
  );
}

const styles = StyleSheet.create({
  group: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  label: { flex: 1, minWidth: 0 },
});
