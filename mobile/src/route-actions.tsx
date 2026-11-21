import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { preparation, sources } from './data/catalog';
import { ExternalLink, GuideButton, GuidePanel, GuideText, icons } from './guide';
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
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.sources}>
      <GuideButton label="Джерела й перевірка" tone="foregroundMuted" row
        accessibilityState={{ expanded }}
        icon={expanded ? 'caret-up' : 'caret-down'}
        onPress={() => setExpanded(!expanded)} />
      {expanded && sourceKeys.map((key) => {
        const source = sources[key];
        return source && (
          <View key={key}>
            <ExternalLink url={source[1]} label={source[0]} tone="accent" icon={icons.external} />
            <GuideText type="meta" tone="foregroundMuted">Посилання перевірено {source[2]}</GuideText>
          </View>
        );
      })}
    </View>
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
      icon={saved ? 'bookmark-fill' : 'bookmark'}
      accessibilityHint={saved ? 'Прибрати маршрут зі збереженого' : undefined}
      accessibilityState={{ selected: saved, disabled: !progress }}
      disabled={!progress}
      onPress={() => toggle('saved', id)}
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

  return (
    <GuidePanel tone="surfaceSoft" style={styles.checklist}>
      <GuideText type="item" heading>Що підготувати</GuideText>
      <GuideText type="meta" tone="foregroundMuted">{checklist.note}</GuideText>
      {progress && <GuideText type="meta" tone="foregroundMuted" announcement>{items.filter(({ checked }) => checked).length} із {items.length} підготовлено</GuideText>}
      {items.map(({ itemId, label, checked }) => (
        <GuideCheckbox key={itemId} label={label} value={checked} disabled={!progress}
          onValueChange={() => toggle('checked', itemId)} style={[styles.item, { borderTopColor: colors.borderStrong }]} />
      ))}
    </GuidePanel>
  );
}

const styles = StyleSheet.create({
  sources: { gap: 4 },
  checklist: { gap: 8 },
  item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
