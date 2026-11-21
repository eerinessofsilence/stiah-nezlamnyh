import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { GuideIcon, GuidePressable, GuideText } from './guide';
import { GuideRadioMark } from './form-controls';
import { type GuideProfile, statuses } from './guide-profile';
import { useGuideColors } from './theme';

export function StatusChoices({ selectedId, onChoose, variant = 'tiles' }: {
  selectedId: GuideProfile['statusId'] | null;
  onChoose: (statusId: GuideProfile['statusId']) => void;
  variant?: 'tiles' | 'rows' | 'links';
}) {
  const colors = useGuideColors();
  const { width, fontScale } = useWindowDimensions();
  const rows = variant === 'rows';
  const links = variant === 'links';
  const twoColumns = !rows && width >= 340 && fontScale < 1.4;

  return (
    <View style={styles.grid}>
      {statuses.map(item => {
        const selected = !links && item.id === selectedId;
        return (
          <GuidePressable key={item.id} accessibilityRole={links ? 'button' : 'radio'}
            accessibilityState={links ? undefined : { checked: selected }}
            accessibilityHint={links ? 'Відкриває послуги для цього статусу' : undefined}
            accessibilityLabel={item.title} onPress={() => onChoose(item.id)}
            android_ripple={{ color: colors.border }}
            style={({ pressed }) => [styles.tile, !twoColumns && styles.fullWidth, rows && styles.row, {
              backgroundColor: pressed || selected ? colors.surfaceMuted : colors.surface,
              borderColor: selected ? colors.foreground : colors.borderStrong,
            }]}>
            <View style={styles.tileTop}>
              <View style={[styles.icon, { backgroundColor: selected ? colors.surface : colors.surfaceMuted }]}>
                <GuideIcon name={item.icon} size={22} />
              </View>
              {rows && <GuideText type="item" style={styles.rowTitle}>{item.title}</GuideText>}
              {!links && <View style={styles.radioTarget}><GuideRadioMark selected={selected} /></View>}
            </View>
            {!rows && <GuideText type="tile">{item.title}</GuideText>}
          </GuidePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48%', flexGrow: 1, minHeight: 116, padding: 16, gap: 8, borderWidth: 1, borderRadius: 18,
    justifyContent: 'space-between', overflow: 'hidden' },
  fullWidth: { width: '100%' },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { minHeight: 56, borderRadius: 14, paddingVertical: 8, justifyContent: 'center' },
  rowTitle: { flex: 1, marginHorizontal: 12 },
  icon: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  radioTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
