import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { askAssistantConsent, storeAssistantEndpoint } from '../assistant-online';
import { GuideSwitch } from '../form-controls';
import { ExternalLink, GuideBackButton, GuidePanel, GuideScreen, GuideText, icons } from '../guide';
import { useGuideState } from '../guide-state';

const siteUrl = process.env.EXPO_PUBLIC_GUIDE_SITE_URL;
const site = siteUrl?.startsWith('https://') ? siteUrl.replace(/\/+$/, '') : undefined;

export default function AboutScreen() {
  const router = useRouter();
  const { assistantConsent, saveAssistantConsent } = useGuideState();
  return (
    <GuideScreen title="Про гід" showOfflineNotice
      titleAction={<GuideBackButton label="Назад" onPress={() => router.canGoBack() ? router.back() : router.replace('/menu')} />}>
      <GuidePanel>
        <GuideText>«Стяг незламних» — незалежний громадський гід для ветеранів, ветеранок, людей з інвалідністю внаслідок війни та їхніх родин.</GuideText>
      </GuidePanel>
      <GuidePanel>
        <GuideText type="section">Конфіденційність</GuideText>
        {storeAssistantEndpoint ? <>
          <View style={styles.row}>
            <GuideText type="item" style={styles.label}>Онлайн-допомога</GuideText>
            <GuideSwitch accessibilityLabel="Онлайн-допомога" value={assistantConsent === true}
              onValueChange={enabled => {
                if (enabled) void askAssistantConsent().then(allowed => saveAssistantConsent(allowed));
                else saveAssistantConsent(false);
              }} />
          </View>
          <GuideText type="support">Пошук у гіді працює на пристрої. З вашим дозволом «Характерник» може звертатися до OpenAI для добору відповіді.</GuideText>
        </> : <GuideText type="support">Пошук у гіді працює на пристрої. Коли ви відкриваєте зовнішній сайт, діє його політика конфіденційності.</GuideText>}
        {site && <>
          <ExternalLink label="Політика конфіденційності" url={site + '/privacy.html'} icon={icons.external} />
          <ExternalLink label="Підтримка" url={site + '/support.html'} icon={icons.external} />
        </>}
      </GuidePanel>
    </GuideScreen>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { flex: 1, minWidth: 0 },
});
