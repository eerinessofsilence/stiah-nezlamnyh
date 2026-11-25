import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { preparation, sources } from './data/catalog';
import { ExternalLink, GuideButton, GuidePanel, GuideText, icons } from './guide';
import { GuideDisclosure } from './guide-disclosure';
import { useGuideColors } from './theme';

export function RouteAction({ action, primary = false }: { action?: string[]; primary?: boolean }) {
  const router = useRouter();
  if (!action) return null;
  const [destination, label] = action;
  const variant = primary ? 'primary' : 'secondary';
  if (destination === 'contacts') {
    return <GuideButton label={label} accessibilityRole="link" variant={variant} fullWidth icon={icons.arrow}
      onPress={() => router.navigate('/contacts')} />;
  }
  return <ExternalLink url={sources[destination]?.[1] ?? destination} label={label} variant={primary ? 'primary' : undefined} fullWidth
    icon={destination.startsWith('tel:') ? icons.phone : icons.external} />;
}

export function RouteSources({ sourceKeys }: { sourceKeys: string[] }) {
  return (
    <GuideDisclosure label="Джерела й перевірка" tone="foregroundMuted">
      {sourceKeys.map((key) => {
        const source = sources[key];
        return source && (
          <View key={key}>
            <ExternalLink url={source[1]} label={source[0]} tone="accent" icon={icons.external} />
          </View>
        );
      })}
    </GuideDisclosure>
  );
}

export function RoutePreparation({ id }: { id: string }) {
  const colors = useGuideColors();
  const list = preparation[id];
  if (!list) return null;

  return (
    <GuidePanel tone="surfaceSoft">
      <GuideText type="section">Що підготувати</GuideText>
      <View role="list" style={styles.list}>
        {list.items.map(([key, label]) => (
          <View key={key} role="listitem" style={styles.item}>
            <View aria-hidden style={[styles.marker, { backgroundColor: colors.accent }]} />
            <GuideText type="support" style={styles.label}>{label}</GuideText>
          </View>
        ))}
      </View>
    </GuidePanel>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  marker: { width: 6, height: 6, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  label: { flex: 1 },
});
