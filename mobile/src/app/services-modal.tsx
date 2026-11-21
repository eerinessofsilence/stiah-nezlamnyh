import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, StyleSheet } from 'react-native';

import { services } from '../data/catalog';
import { GuideButton, GuideIcon, GuidePressable, GuideScreen, GuideText, icons, ServiceList } from '../guide';
import { statuses } from '../guide-profile';
import { useGuideState } from '../guide-state';
import { findServices } from '../search';
import { SearchField } from '../search-field';
import { useGuideColors } from '../theme';

export default function ServicesModal() {
  const router = useRouter();
  const colors = useGuideColors();
  const { profile, setQuery: setCatalogQuery } = useGuideState();
  const [query, setQuery] = useState('');
  const status = statuses.find(item => item.id === profile?.statusId);

  if (!status) return <Redirect href="/" />;

  const statusServices = status.serviceIds.flatMap(id => services.filter(service => service.id === id));
  const searching = query.trim() !== '';
  const results = searching ? findServices(statusServices, query) : statusServices;

  return (
    <GuideScreen title={status.title} sheet adjustForKeyboard
      titleAction={<GuidePressable accessibilityRole="button" accessibilityLabel="Закрити послуги"
        onPress={() => {
        Keyboard.dismiss();
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }} style={({ pressed }) => [styles.close, { backgroundColor: pressed ? colors.surfaceMuted : colors.surfaceSoft }]}>
        <GuideIcon name={icons.close} size={18} />
      </GuidePressable>}>
      <SearchField value={query} onChange={setQuery} />
      {results.length > 0 ? <ServiceList items={results} tiles onOpen={(service, section) => {
        router.dismissTo({ pathname: '/service/[id]', params: { id: service.id, ...(section ? { section } : {}), returnTo: '/services-modal' } });
      }} /> : <>
        <GuideText type="support" tone="foregroundMuted" announcement>Послуг не знайдено. Спробуйте інші слова або запитайте Характерника.</GuideText>
        <GuideButton label="Запитати Характерника" row icon={icons.arrow}
          onPress={() => { Keyboard.dismiss(); router.dismissTo('/assistant'); }} />
      </>}
      <GuideButton label={searching ? 'Усі результати' : 'Усі послуги'} accessibilityRole="link"
        variant="primary" fullWidth icon={icons.arrow} onPress={() => {
          Keyboard.dismiss();
          setCatalogQuery(searching ? query : '');
          router.dismissTo('/services');
        }} />
    </GuideScreen>
  );
}

const styles = StyleSheet.create({
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
