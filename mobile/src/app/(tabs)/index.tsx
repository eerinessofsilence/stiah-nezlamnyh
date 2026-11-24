import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import type { HostInstance } from 'react-native';

import { GuideButton, GuideScreen, GuideText, icons } from '../../guide';
import { GuideLogo } from '../../guide-logo';
import type { GuideProfile } from '../../guide-profile';
import { useGuideState } from '../../guide-state';
import { focusGuideControl } from '../../guide-motion';
import { StatusChoices } from '../../status-choices';

export default function HomeScreen() {
  const router = useRouter();
  const { profile, saveProfile } = useGuideState();
  const statusTrigger = useRef<HostInstance | null>(null);

  useFocusEffect(useCallback(() => {
    if (!statusTrigger.current) return;
    const frame = requestAnimationFrame(() => {
      focusGuideControl(statusTrigger.current);
      statusTrigger.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, []));

  function openStatus(statusId: GuideProfile['statusId'], trigger: HostInstance | null) {
    if (profile?.statusId === statusId || saveProfile({ name: profile?.name ?? '', statusId })) {
      statusTrigger.current = trigger;
      router.navigate('/services-modal');
    }
  }

  return (
    <GuideScreen>
      <GuideLogo style={{ alignSelf: 'flex-start' }} />
      <GuideText type="title">Оберіть статус</GuideText>
      <StatusChoices selectedId={profile?.statusId ?? null} onChoose={openStatus} variant="links" />
      <GuideButton label="Не знаю, з чого почати" row icon={icons.arrow}
        onPress={() => router.push({ pathname: '/service/[id]', params: { id: 'escort' } })} />
      <GuideButton label="Запитати Характерника" accessibilityRole="link" variant="primary" row icon="assistant"
        onPress={() => router.navigate('/assistant')} />
    </GuideScreen>
  );
}
