import { useRouter } from 'expo-router';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { preparation, sources } from './data/catalog';
import { ExternalLink, GuideButton, GuidePanel, GuideText, icons } from './guide';
import { GuideDisclosure } from './guide-disclosure';
import { GuideCheckbox } from './form-controls';
import { useGuideState } from './guide-state';

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

export function RouteChecklist({ id }: { id: string }) {
  const { progress, retryProgress, toggleChecked } = useGuideState();
  const checklist = preparation[id];
  if (!checklist) return null;

  const items = checklist.items.map(([key, label]) => {
    const itemId = `${id}:${key}`;
    return { itemId, label, checked: progress?.checked.includes(itemId) ?? false };
  });
  const progressLabel = (checked: string[]) =>
    `${items.filter(({ itemId }) => checked.includes(itemId)).length} із ${items.length} підготовлено`;

  return (
    <GuidePanel tone="surfaceSoft" style={styles.checklist}>
      <GuideText type="section">Що підготувати</GuideText>
      {progress ? <GuideText type="number" tone="foregroundMuted">{progressLabel(progress.checked)}</GuideText> : <>
        <GuideText>Не вдалося відкрити відмітки.</GuideText>
        <GuideButton label="Спробувати ще раз" onPress={retryProgress} />
      </>}
      {items.map(({ itemId, label, checked }) => (
        <GuideCheckbox key={itemId} label={label} value={checked} disabled={!progress}
          onValueChange={() => {
            const next = toggleChecked(itemId);
            if (next) AccessibilityInfo.announceForAccessibility(progressLabel(next.checked));
          }} style={styles.item} />
      ))}
    </GuidePanel>
  );
}

const styles = StyleSheet.create({
  checklist: { gap: 8 },
  item: { minHeight: 48 },
});
