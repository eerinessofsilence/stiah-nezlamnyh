import { useRouter } from 'expo-router';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { preparation, sources } from './data/catalog';
import { ExternalLink, GuideButton, GuidePanel, GuideText, icons } from './guide';
import { GuideDisclosure } from './guide-disclosure';
import { GuideCheckbox } from './form-controls';
import { useGuideState } from './guide-state';
import { useGuideColors } from './theme';

export function RouteAction({ action, primary = false }: { action?: string[]; primary?: boolean }) {
  const router = useRouter();
  if (!action) return null;
  const [destination, label] = action;
  const variant = primary ? 'primary' : 'secondary';
  if (destination === 'contacts') {
    return <GuideButton label={label} accessibilityRole="link" variant={variant} fullWidth icon={icons.arrow}
      onPress={() => { if (router.canDismiss()) router.dismissAll(); router.navigate('/contacts'); }} />;
  }
  return <ExternalLink url={sources[destination]?.[1] ?? destination} label={label} variant={variant} fullWidth
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
            <GuideText type="meta" tone="foregroundMuted">Посилання перевірено {source[2]}</GuideText>
          </View>
        );
      })}
    </GuideDisclosure>
  );
}

export function ProgressUnavailable() {
  const { retryProgress } = useGuideState();

  return (
    <GuidePanel>
      <GuideText>Не вдалося відкрити збережене.</GuideText>
      <GuideButton label="Спробувати ще раз" onPress={retryProgress} />
    </GuidePanel>
  );
}

export function BookmarkButton({ id }: { id: string }) {
  const { progress, toggle } = useGuideState();
  const saved = progress?.saved.includes(id) ?? false;

  return (
    <GuideButton
      label={saved ? 'Збережено' : 'Зберегти маршрут'}
      row
      icon="bookmark"
      selectedIcon="bookmark-fill"
      accessibilityHint={saved ? 'Прибрати маршрут зі збереженого' : undefined}
      accessibilityState={{ selected: saved, disabled: !progress }}
      disabled={!progress}
      onPress={() => {
        const next = toggle('saved', id);
        if (next) AccessibilityInfo.announceForAccessibility(next.saved.includes(id) ? 'Маршрут збережено' : 'Маршрут прибрано зі збереженого');
      }}
    />
  );
}

export function RouteChecklist({ id }: { id: string }) {
  const { progress, toggle } = useGuideState();
  const colors = useGuideColors();
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
      <GuideText type="meta" tone="foregroundMuted">{checklist.note}</GuideText>
      {progress && <GuideText type="meta" tone="foregroundMuted">{progressLabel(progress.checked)}</GuideText>}
      {items.map(({ itemId, label, checked }) => (
        <GuideCheckbox key={itemId} label={label} value={checked} disabled={!progress}
          onValueChange={() => {
            const next = toggle('checked', itemId);
            if (next) AccessibilityInfo.announceForAccessibility(progressLabel(next.checked));
          }} style={[styles.item, { borderTopColor: colors.borderStrong }]} />
      ))}
    </GuidePanel>
  );
}

const styles = StyleSheet.create({
  checklist: { gap: 8 },
  item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
