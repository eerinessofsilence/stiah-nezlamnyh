import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Keyboard, type TextInputInstance } from 'react-native';

import { groups, services } from '../../../data/catalog';
import { GuideButton, GuideScreen, GuideText, icons, ServiceList } from '../../../guide';
import { useGuideState } from '../../../guide-state';
import { answerSections, findServices } from '../../../search';
import { SearchField } from '../../../search-field';

export default function ServicesScreen() {
  const router = useRouter();
  const { query, setQuery } = useGuideState();
  const input = useRef<TextInputInstance>(null);
  const results = findServices(services, query);

  return (
    <GuideScreen title="Послуги" adjustForKeyboard>
      <SearchField inputRef={input} />
      {!query.trim() ? groups.map(group => (
        <CatalogGroup key={group.id} title={group.title} items={services.filter(service => service.group === group.id)} />
      )) : results.length > 0 ? <ServiceList items={results}
        openSection={service => {
          const [section, alternative] = answerSections(service, query);
          return alternative ? null : section?.id ?? null;
        }} /> : <>
        <GuideText type="support" tone="foregroundMuted" announcement>Нічого не знайшли. Спробуйте коротший запит або запитайте Характерника.</GuideText>
        <GuideButton label="Запитати Характерника" row icon={icons.arrow}
          onPress={() => { Keyboard.dismiss(); router.navigate('/assistant'); }} />
        <GuideButton label="Переглянути всі послуги" row onPress={() => { setQuery(''); input.current?.focus(); }} />
      </>}
    </GuideScreen>
  );
}

function CatalogGroup({ title, items }: { title: string; items: typeof services }) {
  return <><GuideText heading>{title}</GuideText><ServiceList items={items} /></>;
}
