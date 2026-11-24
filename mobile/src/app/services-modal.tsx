import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, StyleSheet } from 'react-native';

import { services } from '../data/catalog';
import { GuideButton, GuideIcon, GuidePressable, GuideScreen, GuideText, icons, ServiceList } from '../guide';
import { statuses } from '../guide-profile';
import { useGuideState } from '../guide-state';
import { answerSections, findSections, findServices } from '../search';
import { SearchField } from '../search-field';
import { useGuideColors } from '../theme';

export default function ServicesModal() {
  const router = useRouter();
  const colors = useGuideColors();
  const { profile } = useGuideState();
  const [query, setQuery] = useState('');
  const status = statuses.find(item => item.id === profile?.statusId);

  if (!status) return <Redirect href="/" />;

  const statusServices = status.serviceIds.flatMap(id => services.filter(service => service.id === id));
  const showSections = 'showSections' in status;
  const searching = query.trim() !== '';
  const results = showSections ? statusServices.flatMap(service =>
    findSections(service.sections, query).map(section => ({ service, section }))) :
    findServices(statusServices, query);

  return (
    <GuideScreen title={status.title} sheet adjustForKeyboard
      titleAction={<GuidePressable accessibilityRole="button" accessibilityLabel="Закрити послуги"
        onPress={() => {
        Keyboard.dismiss();
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }} style={[styles.close, {
        backgroundColor: colors.background,
        borderColor: colors.iconButtonBorder,
        borderWidth: 1,
      }]}>
        <GuideIcon name={icons.close} size={20} />
      </GuidePressable>}>
      <SearchField value={query} onChange={setQuery} label={showSections ? 'Пошук за темами' : 'Пошук послуг'} />
      {results.length > 0 ? <ServiceList items={results} tiles
        openSection={service => {
          if (!searching && status.id === 'military' && service.id === 'msek') return 'military-referral';
          const [section, alternative] = answerSections(service, query);
          return alternative ? null : section?.id ?? null;
        }}
        onOpen={(service, section) => {
          router.dismissTo({ pathname: '/service/[id]', params: {
            id: service.id, ...(section ? { section } : {}), ...(showSections ? { view: 'topic' } : {}), returnTo: '/services-modal',
          } });
        }} /> : <>
        <GuideText type="support" tone="foregroundMuted" announcement>
          {`${showSections ? 'Тем не знайдено.' : 'Послуг не знайдено.'} Спробуйте інші слова або запитайте Характерника.`}
        </GuideText>
        <GuideButton label="Запитати Характерника" row icon={icons.arrow}
          onPress={() => { Keyboard.dismiss(); router.dismissTo('/assistant'); }} />
      </>}
    </GuideScreen>
  );
}

const styles = StyleSheet.create({
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
