import { useRouter } from 'expo-router';

import { ExternalLink, GuideBackButton, GuidePanel, GuideScreen, GuideText, icons } from '../guide';

const siteUrl = process.env.EXPO_PUBLIC_GUIDE_SITE_URL;
const site = siteUrl?.startsWith('https://') ? siteUrl.replace(/\/+$/, '') : undefined;

export default function AboutScreen() {
  const router = useRouter();
  return (
    <GuideScreen title="Про гід" showOfflineNotice
      titleAction={<GuideBackButton label="Назад" onPress={() => router.canGoBack() ? router.back() : router.replace('/menu')} />}>
      <GuidePanel>
        <GuideText>«Стяг незламних» — незалежний громадський гід для ветеранів, ветеранок, людей з інвалідністю внаслідок війни та їхніх родин.</GuideText>
      </GuidePanel>
      <GuidePanel>
        <GuideText type="section">Конфіденційність</GuideText>
        <GuideText type="support">У версії з магазину запитання обробляються на пристрої. Коли ви відкриваєте зовнішній сайт, діє його політика конфіденційності.</GuideText>
        {site && <>
          <ExternalLink label="Політика конфіденційності" url={site + '/privacy.html'} icon={icons.external} />
          <ExternalLink label="Підтримка" url={site + '/support.html'} icon={icons.external} />
        </>}
      </GuidePanel>
    </GuideScreen>
  );
}
