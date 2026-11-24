import { Alert, Linking, StyleSheet, View } from 'react-native';

import { ExternalLink, GuideIcon, GuidePanel, GuidePressable, GuideScreen, GuideText, icons } from '../../guide';
import { GuideSwitch } from '../../form-controls';
import { useGuideAppearance, useGuideColors } from '../../theme';
import { hotline } from '../../data/contacts';

const siteUrl = process.env.EXPO_PUBLIC_GUIDE_SITE_URL;
const site = siteUrl?.startsWith('https://') ? siteUrl.replace(/\/+$/, '') : undefined;
export default function MenuScreen() {
  const { darkMode, setPreference } = useGuideAppearance();
  const colors = useGuideColors();

  return (
    <GuideScreen title="Про гід">
      <GuidePanel>
        <GuideText>«Стяг незламних» — незалежний громадський гід для ветеранів, ветеранок, осіб з інвалідністю внаслідок війни та їхніх родин.</GuideText>
      </GuidePanel>
      <GuidePanel>
        <GuideText type="section">Конфіденційність</GuideText>
        <GuideText type="support">У версії з магазину запитання обробляються на пристрої. Відмітки в чек-листах зберігаються в застосунку. Коли ви відкриваєте зовнішній сайт, діє його політика конфіденційності.</GuideText>
        {site && <View style={styles.links}>
          <ExternalLink compact label="Політика конфіденційності" url={site + '/privacy.html'} icon={icons.external} tone="accent" />
          <ExternalLink compact label="Підтримка" url={site + '/support.html'} icon={icons.external} tone="accent" />
        </View>}
      </GuidePanel>
      <GuidePanel>
        <View style={styles.themeToggle}>
          <GuideText type="item">Темна тема</GuideText>
          <GuideSwitch accessibilityLabel="Темна тема" value={darkMode}
            onValueChange={enabled => setPreference(enabled ? 'dark' : 'light')}
            style={{ transform: [{ translateY: 10 }] }} />
        </View>
      </GuidePanel>
      <GuidePressable accessibilityRole="link"
        accessibilityLabel={`Зателефонувати на гарячу лінію для ветеранів: ${hotline.phone}`}
        onPress={() => Linking.openURL(hotline.dial).catch(() => Alert.alert('Не вдалося відкрити виклик', hotline.phone))}
        pressedColor={colors.surface} style={[styles.hotline, { backgroundColor: colors.surfaceSoft }]}>
        <View style={[styles.icon, { backgroundColor: colors.surface }]}><GuideIcon name={icons.phone} size={22} /></View>
        <View style={styles.copy}>
          <GuideText type="item">Гаряча лінія для ветеранів</GuideText>
          <GuideText type="item">{hotline.phone}</GuideText>
        </View>
      </GuidePressable>
    </GuideScreen>
  );
}

const styles = StyleSheet.create({
  themeToggle: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  links: { marginTop: 0, paddingVertical: 6, gap: 0 },
  hotline: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, justifyContent: 'center', gap: 2 },
});
