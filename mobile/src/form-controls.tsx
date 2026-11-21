import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuideIcon, GuidePressable, GuideText, icons } from './guide';
import { useGuideColors } from './theme';
import { typography } from './typography';

export function GuideInputFrame({ children, focused = false, radius = 10, style }: {
  children: ReactNode; focused?: boolean; radius?: 8 | 10 | 16; style?: ComponentProps<typeof View>['style'];
}) {
  const colors = useGuideColors();
  return <View style={[styles.frame, {
    backgroundColor: colors.surface, borderColor: focused ? colors.foreground : colors.borderStrong, borderRadius: radius,
    outlineColor: colors.foreground, outlineWidth: focused ? 1 : 0,
  }, style]}>{children}</View>;
}

export function GuideInputPlaceholder({ children }: { children: string }) {
  const colors = useGuideColors();
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.placeholderWrap}>
    <Text style={[typography.body, { color: colors.foregroundMuted }]}>{children}</Text>
  </View>;
}

export function GuideTextArea({ label, ...props }: Pick<ComponentProps<typeof TextInput>,
  'value' | 'onChangeText' | 'placeholder' | 'maxLength' | 'editable'> & { label: string }) {
  const colors = useGuideColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <GuideText type="support" tone="foregroundMuted">{label}</GuideText>
      <GuideInputFrame focused={focused}>
        <TextInput {...props} accessibilityLabel={label} accessibilityLanguage="uk" multiline textAlignVertical="top"
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholderTextColor={colors.foregroundMuted}
          selectionColor={colors.accent} underlineColorAndroid="transparent"
          style={[typography.body, styles.textArea, { color: colors.foreground }]} />
      </GuideInputFrame>
    </View>
  );
}

export type GuideChoice = { label: string; value: string; description?: string; disabled?: boolean };

function GuideSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const colors = useGuideColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" statusBarTranslucent visible onRequestClose={onClose}>
      <View style={styles.modal}>
        <Pressable accessible={false} focusable={false} style={[styles.backdrop, { backgroundColor: `${colors.foreground}99` }]} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={styles.sheetHeader}>
            <GuideText type="item" style={styles.sheetTitle}>{title}</GuideText>
            <GuidePressable accessibilityRole="button" accessibilityLabel="Закрити" onPress={onClose} style={styles.close}>
              <GuideIcon name={icons.close} size={18} />
            </GuidePressable>
          </View>
          {children}
          <GuidePressable accessibilityRole="button" accessibilityLabel="Готово" onPress={onClose} style={styles.done}>
            <Text style={[typography.item, { color: colors.accent }]}>Готово</Text>
          </GuidePressable>
        </View>
      </View>
    </Modal>
  );
}

export function GuideSelect({ label, value, options, onChange, placeholder = 'Оберіть значення', disabled = false }: {
  label: string; value: string | null; options: GuideChoice[]; onChange: (value: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const colors = useGuideColors();
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return (
    <>
      <View style={styles.fieldGroup}>
        <GuideText type="support" tone="foregroundMuted">{label}</GuideText>
        <GuidePressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
          accessibilityState={{ disabled, expanded: open }} disabled={disabled}
          onPress={() => setOpen(true)} style={[styles.pressable, { opacity: disabled ? 0.5 : 1 }]}>
          <GuideInputFrame focused={open} radius={10} style={styles.selectField}>
            <Text numberOfLines={1} style={[typography.body, styles.selectValue, { color: selected ? colors.foreground : colors.foregroundMuted }]}>
              {selected?.label ?? placeholder}
            </Text>
            <GuideIcon name="caret-down" color={colors.foregroundMuted} size={20} />
          </GuideInputFrame>
        </GuidePressable>
      </View>
      {open && <GuideSheet title={label} onClose={() => setOpen(false)}>
        <ScrollView style={styles.options}>
          {options.map(option => {
            const active = option.value === value;
            return <GuidePressable key={option.value} accessibilityRole="radio" accessibilityLanguage="uk" accessibilityState={{ checked: active, disabled: option.disabled }}
              accessibilityLabel={option.description ? `${option.label}. ${option.description}` : option.label}
              disabled={option.disabled} onPress={() => { onChange(option.value); setOpen(false); }}
              style={[styles.option, { borderBottomColor: colors.border, opacity: option.disabled ? 0.5 : 1 }]}>
              <View style={styles.optionCopy}>
                <GuideText type="item">{option.label}</GuideText>
                {option.description && <GuideText type="support" tone="foregroundMuted">{option.description}</GuideText>}
              </View>
              <GuideRadioMark selected={active} />
            </GuidePressable>;
          })}
        </ScrollView>
      </GuideSheet>}
    </>
  );
}

export function GuideDatePicker({ label, value, onChange, placeholder = 'Оберіть дату', minimumDate, maximumDate, disabled = false }: {
  label: string; value: Date | null; onChange: (value: Date) => void; placeholder?: string;
  minimumDate?: Date; maximumDate?: Date; disabled?: boolean;
}) {
  const colors = useGuideColors();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStart(value ?? new Date()));
  const selectedText = value ? new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' }).format(value) : placeholder;
  const firstWeekday = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const monthLabel = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(month);

  function choose(day: number) {
    const selected = new Date(month.getFullYear(), month.getMonth(), day, 12);
    onChange(selected);
    setOpen(false);
  }

  return (
    <>
      <View style={styles.fieldGroup}>
        <GuideText type="support" tone="foregroundMuted">{label}</GuideText>
        <GuidePressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? selectedText : placeholder}`}
          accessibilityState={{ disabled, expanded: open }} disabled={disabled}
          onPress={() => { setMonth(monthStart(value ?? new Date())); setOpen(true); }} style={[styles.pressable, { opacity: disabled ? 0.5 : 1 }]}>
          <GuideInputFrame focused={open} radius={10} style={styles.selectField}>
            <GuideIcon name="calendar" color={colors.foregroundMuted} size={20} />
            <Text numberOfLines={1} style={[typography.body, styles.selectValue, { color: value ? colors.foreground : colors.foregroundMuted }]}>{selectedText}</Text>
          </GuideInputFrame>
        </GuidePressable>
      </View>
      {open && <GuideSheet title={label} onClose={() => setOpen(false)}>
        <View style={styles.calendarHeader}>
          <GuidePressable accessibilityRole="button" accessibilityLanguage="uk" accessibilityLabel="Попередній місяць" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={styles.monthButton}>
            <GuideIcon name={icons.back} />
          </GuidePressable>
          <Text style={[typography.item, styles.monthLabel, { color: colors.foreground }]}>{monthLabel}</Text>
          <GuidePressable accessibilityRole="button" accessibilityLanguage="uk" accessibilityLabel="Наступний місяць" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={styles.monthButton}>
            <GuideIcon name={icons.next} />
          </GuidePressable>
        </View>
        <View style={styles.calendarGrid}>
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(day => <Text key={day} style={[typography.meta, styles.weekday, { color: colors.foregroundMuted }]}>{day}</Text>)}
          {cells.map((day, index) => {
            if (day === null) return <View key={`blank-${index}`} style={styles.dayCell} />;
            const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
            const key = date.getTime();
            const selected = value?.getFullYear() === date.getFullYear() && value.getMonth() === date.getMonth() && value.getDate() === day;
            const unavailable = (minimumDate && key < dayStart(minimumDate)) || (maximumDate && key > dayEnd(maximumDate));
            return <GuidePressable key={day} accessibilityRole="button" accessibilityLanguage="uk"
              accessibilityLabel={new Intl.DateTimeFormat('uk-UA', { dateStyle: 'full' }).format(date)}
              accessibilityState={{ selected, disabled: !!unavailable }} disabled={!!unavailable} onPress={() => choose(day)}
              style={[styles.dayCell, styles.dayButton, { backgroundColor: selected ? colors.primaryButton : 'transparent' }]}>
              <Text style={[typography.support, { color: selected ? colors.onPrimaryButton : unavailable ? colors.foregroundMuted : colors.foreground }]}>{day}</Text>
            </GuidePressable>;
          })}
        </View>
      </GuideSheet>}
    </>
  );
}

export function GuideRadioGroup({ label, value, options, onChange }: {
  label: string; value: string | null; options: GuideChoice[]; onChange: (value: string) => void;
}) {
  const colors = useGuideColors();
  return <View style={styles.fieldGroup}>
    <GuideText type="item">{label}</GuideText>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.radioGroup}>
      {options.map(option => {
        const selected = option.value === value;
        return <GuidePressable key={option.value} accessibilityRole="radio" accessibilityLanguage="uk" accessibilityLabel={option.label}
          accessibilityState={{ checked: selected, disabled: option.disabled }} disabled={option.disabled}
          onPress={() => onChange(option.value)} style={[styles.option, { borderBottomColor: colors.border, opacity: option.disabled ? 0.5 : 1 }]}>
          <View style={styles.optionCopy}>
            <GuideText type="item">{option.label}</GuideText>
            {option.description && <GuideText type="support" tone="foregroundMuted">{option.description}</GuideText>}
          </View>
          <GuideRadioMark selected={selected} />
        </GuidePressable>;
      })}
    </View>
  </View>;
}

export function GuideCheckbox({ label, value, onValueChange, disabled = false, style }: {
  label: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean; style?: ComponentProps<typeof View>['style'];
}) {
  const colors = useGuideColors();
  return <GuidePressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }}
    disabled={disabled} onPress={() => onValueChange(!value)} android_ripple={{ color: colors.border }}
    style={({ pressed }) => [styles.option, styles.checkboxRow, style, { backgroundColor: pressed ? colors.surfaceMuted : 'transparent', opacity: disabled ? 0.55 : 1 }]}>
    <View style={[styles.checkbox, { borderColor: value ? colors.accent : colors.borderStrong, backgroundColor: value ? colors.button : colors.surface }]}>
      {value && <GuideIcon name="check" color={colors.onAccent} size={16} />}
    </View>
    <GuideText type="support" style={styles.optionCopy}>{label}</GuideText>
  </GuidePressable>;
}

export function GuideSwitch({ value, onValueChange, accessibilityLabel, disabled }: {
  value: boolean; onValueChange: (value: boolean) => void; accessibilityLabel: string; disabled?: boolean;
}) {
  const colors = useGuideColors();
  return <Switch accessibilityLabel={accessibilityLabel} accessibilityLanguage="uk" value={value} onValueChange={onValueChange} disabled={disabled}
    trackColor={{ false: colors.surfaceMuted, true: colors.accent }} thumbColor={colors.surface}
    ios_backgroundColor={colors.surfaceMuted} style={{ minHeight: 44 }} />;
}

export function GuideRadioMark({ selected }: { selected: boolean }) {
  const colors = useGuideColors();
  return <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.borderStrong }]}>
    {selected && <View style={[styles.radioDot, { backgroundColor: colors.accent }]} />}
  </View>;
}

function monthStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function dayStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }
function dayEnd(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1; }

const styles = StyleSheet.create({
  frame: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  placeholderWrap: { position: 'absolute', left: 0, right: 8, top: 0, bottom: 0, justifyContent: 'center', transform: [{ translateY: 2 }] },
  textArea: { flex: 1, minHeight: 120, paddingVertical: 12, includeFontPadding: false },
  pressable: { alignSelf: 'stretch' },
  selectField: { width: '100%', gap: 8 },
  fieldGroup: { gap: 4 },
  selectValue: { flex: 1, minWidth: 0 },
  modal: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { maxHeight: '85%', borderTopWidth: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, gap: 12 },
  sheetHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { flex: 1 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  options: { flexGrow: 0 },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  optionCopy: { flex: 1 },
  done: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  calendarHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { textTransform: 'capitalize' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -16 },
  weekday: { width: '14.2857%', height: 36, textAlign: 'center', textAlignVertical: 'center' },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayButton: { borderRadius: 24 },
  radioGroup: { gap: 4 },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  checkboxRow: { minHeight: 56, borderBottomWidth: 0 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
