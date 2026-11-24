import { useRouter } from 'expo-router';

import { GuideBackButton, GuideScreen } from '../guide';
import { GuideContacts } from '../guide-contacts';

export default function ContactsScreen() {
  const router = useRouter();
  return (
    <GuideScreen title="Контакти" adjustForKeyboard showOfflineNotice
      titleAction={<GuideBackButton label="Назад" onPress={() => router.canGoBack() ? router.back() : router.replace('/menu')} />}>
      <GuideContacts />
    </GuideScreen>
  );
}
