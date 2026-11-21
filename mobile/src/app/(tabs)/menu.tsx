import { Alert, Linking, StyleSheet, View } from 'react-native';

import { ExternalLink, GuideIcon, GuidePanel, GuidePressable, GuideScreen, GuideText, icons } from '../../guide';
import { GuideSwitch } from '../../form-controls';
import { useGuideAppearance, useGuideColors } from '../../theme';
import { hotline } from '../../data/contacts';

const siteUrl = process.env.EXPO_PUBLIC_GUIDE_SITE_URL;
const site = siteUrl?.startsWith('https://') ? siteUrl.replace(/\/+$/, '') : undefined;

export default function MenuScreen() {
  const { darkMode, setDarkMode } = useGuideAppearance();
  const colors = useGuideColors();

  return (
    <GuideScreen title="Про гід">
      <GuidePanel>
        <GuideText>«Стяг незламних» — незалежний громадський гід для ветеранів, ветеранок, осіб з інвалідністю внаслідок війни та їхніх родин.</GuideText>
      </GuidePanel>
      <GuidePanel tone="surfaceSoft">
        <GuideText type="section">Як користуватися</GuideText>
        <GuideText type="support">Маршрути та контакти доступні офлайн.</GuideText>
      </GuidePanel>
      <GuidePanel>
        <GuideText type="section">Конфіденційність</GuideText>
        <GuideText type="support">У версії з магазину запитання обробляються на пристрої. Закладки та відмітки зберігаються в застосунку. Коли ви відкриваєте зовнішній сайт, діє його політика конфіденційності.</GuideText>
        {site && <View style={styles.links}>
          <ExternalLink label="Політика конфіденційності" url={site + '/privacy.html'} icon={icons.external} tone="accent" />
          <ExternalLink label="Підтримка" url={site + '/support.html'} icon={icons.external} tone="accent" />
        </View>}
      </GuidePanel>
      <GuidePanel style={styles.appearance}>
        <GuideText type="item" style={styles.label}>Темна тема</GuideText>
        <GuideSwitch accessibilityLabel="Темна тема" value={darkMode} onValueChange={setDarkMode} />
      </GuidePanel>
      <GuidePressable accessibilityRole="link"
        accessibilityLabel={`Зателефонувати на гарячу лінію для ветеранів: ${hotline.phone}`}
        onPress={() => Linking.openURL(hotline.dial).catch(() => Alert.alert('Не вдалося відкрити виклик', hotline.phone))}
        android_ripple={{ color: colors.border }}
        style={({ pressed }) => [styles.hotline, { backgroundColor: pressed ? colors.surfaceMuted : colors.surfaceSoft }]}>
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
  appearance: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  label: { flex: 1 },
  links: { marginTop: 0, gap: 0 },
  hotline: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, justifyContent: 'center', gap: 2 },
});
