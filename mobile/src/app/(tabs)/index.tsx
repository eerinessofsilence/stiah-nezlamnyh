import { useRouter } from 'expo-router';
import { Alert, Keyboard, Linking, Pressable, StyleSheet, View } from 'react-native';

import { featured, services } from '../../data/catalog';
import { hotline } from '../../data/contacts';
import { GuideButton, GuideIcon, GuideScreen, GuideText, icons, ServiceList } from '../../guide';
import { useGuideState } from '../../guide-state';
import { findServices } from '../../search';
import { SearchField } from '../../search-field';
import { useGuideColors } from '../../theme';

export default function HomeScreen() {
  const router = useRouter();
  const colors = useGuideColors();
  const { query, setQuery } = useGuideState();
  const searching = !!query.trim();
  const results = searching ? findServices(services, query) : featured.flatMap(id => services.filter(service => service.id === id));

  return (
    <GuideScreen title="ЗАСТОСУНОК ДЛЯ ВЕТЕРАНІВ" titleType="sheetTitle" adjustForKeyboard>
      <GuideText type="support" tone="muted">Та сімей загиблих (померлих) захисників України</GuideText>
      <SearchField />
      {results.length > 0
        ? <ServiceList items={results.slice(0, 6)} tiles />
        : <GuideText type="support" tone="muted" announcement>Послуг не знайдено. Спробуйте інші слова або запитайте Характерника.</GuideText>}
      {!results.length && <GuideButton label="Запитати Характерника" row icon={icons.arrow}
        onPress={() => { Keyboard.dismiss(); router.navigate('/assistant'); }} />}
      <GuideButton label={searching && results.length > 0 ? "Усі результати" : "Усі послуги"} accessibilityRole="link" variant="primary" fullWidth icon={icons.arrow}
        onPress={() => {
          Keyboard.dismiss();
          if (!results.length) setQuery('');
          router.navigate('/services');
        }} />
      {!searching && <GuideButton label="Не знаю, з чого почати" row icon={icons.arrow}
        onPress={() => router.push({ pathname: '/service/[id]', params: { id: 'escort' } })} />}
      <Pressable accessibilityRole="link"
        accessibilityLabel={`Зателефонувати на гарячу лінію для ветеранів: ${hotline.phone}`}
        onPress={() => Linking.openURL(hotline.dial).catch(() => Alert.alert('Не вдалося відкрити виклик', hotline.phone))}
        android_ripple={{ color: colors.line }}
        style={({ pressed }) => [styles.hotline, { backgroundColor: pressed ? colors.surfaceMuted : colors.soft }]}>
        <View style={[styles.icon, { backgroundColor: colors.surface }]}><GuideIcon name={icons.phone} size={22} /></View>
        <View style={styles.copy}>
          <GuideText type="tile" heading>Гаряча лінія для ветеранів</GuideText>
          <GuideText type="item">{hotline.phone}</GuideText>
        </View>
      </Pressable>
    </GuideScreen>
  );
}

const styles = StyleSheet.create({
  hotline: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, justifyContent: 'center', gap: 2 },
});
