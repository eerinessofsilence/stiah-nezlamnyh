import { useRouter } from 'expo-router';
import { Keyboard } from 'react-native';

import { groups, services } from '../../../data/catalog';
import { GuideButton, GuideScreen, GuideText, icons, ServiceList } from '../../../guide';
import { useGuideState } from '../../../guide-state';
import { findServices } from '../../../search';
import { SearchField } from '../../../search-field';

export default function ServicesScreen() {
  const router = useRouter();
  const { query, setQuery } = useGuideState();
  const results = findServices(services, query);

  return (
    <GuideScreen title="Послуги" adjustForKeyboard>
      <SearchField />
      {!query.trim() ? groups.map(group => (
        <CatalogGroup key={group.id} title={group.title} items={services.filter(service => service.group === group.id)} />
      )) : results.length > 0 ? <ServiceList items={results} /> : <>
        <GuideText type="support" tone="muted" announcement>Нічого не знайшли. Спробуйте коротший запит або запитайте Характерника.</GuideText>
        <GuideButton label="Запитати Характерника" row icon={icons.arrow}
          onPress={() => { Keyboard.dismiss(); router.navigate('/assistant'); }} />
        <GuideButton label="Переглянути всі послуги" row onPress={() => { Keyboard.dismiss(); setQuery(''); }} />
      </>}
    </GuideScreen>
  );
}

function CatalogGroup({ title, items }: { title: string; items: typeof services }) {
  return <><GuideText heading>{title}</GuideText><ServiceList items={items} /></>;
}
