import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, type HostInstance, View } from 'react-native';

import { services } from '../../data/catalog';
import { GuideButton, GuideIconButton, GuideScreen, GuideText, ServiceList, icons } from '../../guide';
import { GuideLogo } from '../../guide-logo';
import type { GuideProfile } from '../../guide-profile';
import { useGuideState } from '../../guide-state';
import { focusGuideControl } from '../../guide-motion';
import { StatusChoices } from '../../status-choices';

const sportsServices = services.filter(service => service.id === 'veteran-sports');

export default function HomeScreen() {
  const router = useRouter();
  const { profile, saveProfile } = useGuideState();
  const notificationsButton = useRef<HostInstance | null>(null);
  const returnFocus = useRef<HostInstance | null>(null);

  useFocusEffect(useCallback(() => {
    if (!returnFocus.current) return;
    const frame = requestAnimationFrame(() => {
      focusGuideControl(returnFocus.current);
      returnFocus.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, []));

  function openStatus(statusId: GuideProfile['statusId'], trigger: HostInstance | null) {
    if (profile?.statusId === statusId || saveProfile({ name: profile?.name ?? '', statusId })) {
      returnFocus.current = trigger;
      router.navigate('/services-modal');
    }
  }

  return (
    <GuideScreen>
      <GuideLogo style={{ alignSelf: 'flex-start', width: 248, height: 61.3, maxWidth: '100%' }} />
      <View style={styles.headingRow}>
        <GuideText type="title" style={styles.heading}>Оберіть статус</GuideText>
        <GuideIconButton ref={notificationsButton} icon="bell" label="Сповіщення" onPress={() => {
          returnFocus.current = notificationsButton.current;
          router.navigate('/notifications');
        }} />
      </View>
      <StatusChoices selectedId={profile?.statusId ?? null} onChoose={openStatus} variant="links" />
      <ServiceList items={sportsServices} showChevron={false} style={{ marginTop: -4 }} />
      <GuideButton label="Не знаю, з чого почати" row icon={icons.arrow}
        onPress={() => router.push({ pathname: '/service/[id]', params: { id: 'escort' } })} />
      <GuideButton label="Запитати Характерника" accessibilityRole="link" variant="primary" row icon="assistant"
        onPress={() => router.navigate('/assistant')} />
    </GuideScreen>
  );
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { flex: 1 },
});
