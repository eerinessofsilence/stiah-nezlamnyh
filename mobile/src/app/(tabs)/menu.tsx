import { StyleSheet, Switch } from 'react-native';

import { ExternalLink, GuidePanel, GuideScreen, GuideText } from '../../guide';
import { useGuideAppearance } from '../../theme';

const siteUrl = process.env.EXPO_PUBLIC_GUIDE_SITE_URL;
const site = siteUrl?.startsWith('https://') ? siteUrl.replace(/\/+$/, '') : undefined;

export default function MenuScreen() {
  const { darkMode, setDarkMode } = useGuideAppearance();

  return (
    <GuideScreen title="Про гід">
      <GuidePanel>
        <GuideText>«Стяг незламних» — незалежний громадський гід для ветеранів, ветеранок, осіб з інвалідністю внаслідок війни та їхніх родин.</GuideText>
        <GuideText type="support" tone="muted">Інструкції базуються на відкритих офіційних джерелах.</GuideText>
        <GuideText type="support" tone="muted">Гід не є державним застосунком і не представляє органи влади.</GuideText>
      </GuidePanel>
      <GuidePanel style={styles.appearance}>
        <GuideText type="item" style={styles.label}>Темна тема</GuideText>
        <Switch accessibilityLabel="Темна тема" value={darkMode} onValueChange={setDarkMode} />
      </GuidePanel>
      <GuidePanel tone="soft">
        <GuideText type="item" heading>Як користуватися</GuideText>
        <GuideText type="support">Маршрути та контакти можна читати офлайн. Для дзвінків, заяв і запису використовуйте вказані установи та сервіси.</GuideText>
        <GuideText type="support">Матеріали про здоров’я пояснюють, куди звернутися по допомогу. Гід не є медичним виробом, не діагностує та не лікує. З медичних питань звертайтеся до лікаря.</GuideText>
      </GuidePanel>
      <GuidePanel>
        <GuideText type="item" heading>Конфіденційність</GuideText>
        <GuideText type="support">У версії з магазину запитання обробляються на пристрої. Закладки та відмітки зберігаються в застосунку. Коли ви відкриваєте зовнішній сайт, діє його політика конфіденційності.</GuideText>
        {site && <ExternalLink label="Політика конфіденційності" url={site + '/privacy.html'} />}
        {site && <ExternalLink label="Підтримка" url={site + '/support.html'} />}
      </GuidePanel>
    </GuideScreen>
  );
}

const styles = StyleSheet.create({
  appearance: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  label: { flex: 1 },
});
