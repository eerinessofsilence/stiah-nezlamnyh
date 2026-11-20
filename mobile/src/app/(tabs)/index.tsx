import { useRouter } from 'expo-router';
import { Alert, Keyboard, Linking, Pressable, StyleSheet, View } from 'react-native';

import { services } from '../../data/catalog';
import { hotline } from '../../data/contacts';
import { GuideButton, GuideIcon, GuideScreen, GuideText, icons, ServiceList } from '../../guide';
import { statuses } from '../../guide-profile';
import { useGuideState } from '../../guide-state';
import { findServices } from '../../search';
import { SearchField } from '../../search-field';
import { useGuideColors } from '../../theme';

export default function HomeScreen() {
  const router = useRouter();
  const colors = useGuideColors();
  const { profile, query, setQuery } = useGuideState();
  const status = statuses.find(item => item.id === profile?.statusId);
  const statusServices = status ? status.serviceIds.flatMap(id => services.filter(service => service.id === id)) : [];
  const results = query.trim() ? findServices(statusServices, query) : statusServices;
  const changeStatus = status && (
    <GuideButton label="Змінити" accessibilityLabel={`Змінити статус. Поточний статус: ${status.title}`}
      icon={{ ios: 'chevron.down', android: 'expand_more' }}
      onPress={() => { Keyboard.dismiss(); router.push('/profile'); }} />
  );

  return (
    <GuideScreen title={status?.title ?? 'Головна'} titleAction={changeStatus} adjustForKeyboard>
      <SearchField />
      {results.length > 0
        ? <ServiceList items={results} tiles />
        : <GuideText type="support" tone="muted" announcement>Послуг не знайдено. Спробуйте інші слова або запитайте Характерника.</GuideText>}
      {!results.length && <GuideButton label="Запитати Характерника" row icon={icons.arrow}
        onPress={() => { Keyboard.dismiss(); router.navigate('/assistant'); }} />}
      <GuideButton label={query.trim() && results.length > 0 ? 'Усі результати' : 'Усі послуги'} accessibilityRole="link" variant="primary" fullWidth icon={icons.arrow}
        onPress={() => {
          Keyboard.dismiss();
          if (!results.length) setQuery('');
          router.navigate('/services');
        }} />
      {!query.trim() && <GuideButton label="Не знаю, з чого почати" row icon={icons.arrow}
        onPress={() => router.push({ pathname: '/service/[id]', params: { id: 'escort' } })} />}
      <Pressable accessibilityRole="link"
        accessibilityLabel={`Зателефонувати на гарячу лінію для ветеранів: ${hotline.phone}`}
        onPress={() => Linking.openURL(hotline.dial).catch(() => Alert.alert('Не вдалося відкрити виклик', hotline.phone))}
        android_ripple={{ color: colors.line }}
        style={({ pressed }) => [styles.hotline, { backgroundColor: pressed ? colors.surfaceMuted : colors.soft }]}>
        <View style={[styles.icon, { backgroundColor: colors.surface }]}><GuideIcon name={icons.phone} size={22} /></View>
        <View style={styles.copy}>
          <GuideText type="item">Гаряча лінія для ветеранів</GuideText>
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
