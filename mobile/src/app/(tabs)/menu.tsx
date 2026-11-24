import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Keyboard, StyleSheet } from 'react-native';

import { ExternalLink, GuideIcon, GuidePanel, GuidePressable, GuideScreen, GuideText, icons } from '../../guide';
import { GuideSwitch } from '../../form-controls';
import { GuideContacts } from '../../guide-contacts';
import { useGuideAppearance, useGuideColors } from '../../theme';

const siteUrl = process.env.EXPO_PUBLIC_GUIDE_SITE_URL;
const site = siteUrl?.startsWith('https://') ? siteUrl.replace(/\/+$/, '') : undefined;
const version = Constants.expoConfig?.version;

export default function MenuScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { darkMode, setPreference } = useGuideAppearance();

  function toggleSection(next: 'contacts' | 'about') {
    Keyboard.dismiss();
    router.setParams({ section: section === next ? '' : next });
  }

  return (
    <GuideScreen title="Меню" adjustForKeyboard>
      {version && <GuideText type="meta" tone="foregroundMuted">Версія {version}</GuideText>}
      <GuidePanel style={styles.group}>
        <MenuSection label="Контакти" icon="users" expanded={section === 'contacts'} onPress={() => toggleSection('contacts')} />
        <MenuSection label="Про гід" icon="info" expanded={section === 'about'} onPress={() => toggleSection('about')} divided />
      </GuidePanel>
      <GuidePanel style={[styles.group, styles.row]}>
        <GuideText type="item" style={styles.label}>Темна тема</GuideText>
        <GuideSwitch accessibilityLabel="Темна тема" value={darkMode}
          onValueChange={enabled => setPreference(enabled ? 'dark' : 'light')} />
      </GuidePanel>
      {section === 'contacts' && <GuideContacts />}
      {section === 'about' && <AboutGuide />}
    </GuideScreen>
  );
}

function MenuSection({ label, icon, expanded, onPress, divided = false }: {
  label: string; icon: 'users' | 'info'; expanded: boolean; onPress: () => void; divided?: boolean;
}) {
  const colors = useGuideColors();
  return (
    <GuidePressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }} onPress={onPress}
      style={[styles.row, expanded && { backgroundColor: colors.surfaceSoft },
        divided && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <GuideIcon name={expanded ? `${icon}-fill` : icon} size={22} />
      <GuideText type="item" style={styles.label}>{label}</GuideText>
      <GuideIcon name={expanded ? 'caret-up' : 'caret-down'} color={colors.foregroundMuted} size={18} />
    </GuidePressable>
  );
}

function AboutGuide() {
  return (
    <>
      <GuidePanel>
        <GuideText>«Стяг незламних» — незалежний громадський гід для ветеранів, ветеранок, людей з інвалідністю внаслідок війни та їхніх родин.</GuideText>
      </GuidePanel>
      <GuidePanel>
        <GuideText type="section">Конфіденційність</GuideText>
        <GuideText type="support">У версії з магазину запитання обробляються на пристрої. Відмітки в чек-листах зберігаються в застосунку. Коли ви відкриваєте зовнішній сайт, діє його політика конфіденційності.</GuideText>
        {site && <>
          <ExternalLink label="Політика конфіденційності" url={site + '/privacy.html'} icon={icons.external} />
          <ExternalLink label="Підтримка" url={site + '/support.html'} icon={icons.external} />
        </>}
      </GuidePanel>
    </>
  );
}

const styles = StyleSheet.create({
  group: { padding: 0, gap: 0, overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  label: { flex: 1, minWidth: 0 },
});
