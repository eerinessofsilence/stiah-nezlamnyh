import { useRouter } from 'expo-router';

import { GuideButton, GuideScreen, icons } from '../../guide';
import type { GuideProfile } from '../../guide-profile';
import { useGuideState } from '../../guide-state';
import { StatusChoices } from '../../status-choices';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, saveProfile } = useGuideState();

  function openStatus(statusId: GuideProfile['statusId']) {
    if (profile?.statusId === statusId || saveProfile({ name: profile?.name ?? '', statusId })) {
      router.push('/services-modal');
    }
  }

  return (
    <GuideScreen title="Оберіть статус">
      <StatusChoices selectedId={profile?.statusId ?? null} onChoose={openStatus} variant="links" />
      <GuideButton label="Не знаю, з чого почати" row icon={icons.arrow}
        onPress={() => router.push({ pathname: '/service/[id]', params: { id: 'escort' } })} />
    </GuideScreen>
  );
}
