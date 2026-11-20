import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { preparation, sources } from './data/catalog';
import { ExternalLink, GuideButton, GuidePanel, GuideText, icons } from './guide';
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
      <GuideButton label="Джерела й перевірка" tone="muted" row
        accessibilityState={{ expanded }}
        icon={expanded ? { ios: 'chevron.up', android: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more' }}
        onPress={() => setExpanded(!expanded)} />
      {expanded && sourceKeys.map((key) => {
        const source = sources[key];
        return source && (
          <View key={key}>
            <ExternalLink url={source[1]} label={source[0]} tone="muted" icon={icons.external} />
            <GuideText type="meta" tone="muted">Посилання перевірено {source[2]}</GuideText>
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
      icon={{ ios: saved ? 'bookmark.fill' : 'bookmark', android: saved ? 'bookmark' : 'bookmark_border' }}
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
    <GuidePanel tone="soft" style={styles.checklist}>
      <GuideText type="item" heading>Що підготувати</GuideText>
      <GuideText type="meta" tone="muted">{checklist.note}</GuideText>
      {progress && <GuideText type="meta" tone="muted" announcement>{items.filter(({ checked }) => checked).length} із {items.length} підготовлено</GuideText>}
      {items.map(({ itemId, label, checked }) => (
        <Pressable
          key={itemId}
          accessibilityRole="checkbox"
          accessibilityLabel={label}
          accessibilityState={{ checked, disabled: !progress }}
          disabled={!progress}
          onPress={() => toggle('checked', itemId)}
          android_ripple={{ color: colors.line }}
          style={[styles.item, { borderTopColor: colors.lineStrong }]}
        >
          <View style={[styles.box, { borderColor: colors.accent, backgroundColor: checked ? colors.button : colors.surface }]}>
            {checked && <Text accessible={false} allowFontScaling={false} style={{ color: colors.onAccent, fontWeight: '700' }}>✓</Text>}
          </View>
          <GuideText type="support" style={styles.label}>{label}</GuideText>
        </Pressable>
      ))}
    </GuidePanel>
  );
}

const styles = StyleSheet.create({
  sources: { gap: 4 },
  checklist: { gap: 8 },
  item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
