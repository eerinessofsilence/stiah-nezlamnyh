import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import {
  Animated, type HostInstance, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, type TextInstance, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuideIcon, GuidePressable, GuideText, icons } from './guide';
import { focusGuideControl, useGuideTransition, useReducedMotion } from './guide-motion';
import { useGuideColors } from './theme';
import { typography } from './typography';

const defaultInputRadius = 12;

export function GuideInputFrame({ children, focused = false, radius = defaultInputRadius, style, transparent = false }: {
  children: ReactNode; focused?: boolean; radius?: 10 | 12 | 18; style?: ComponentProps<typeof View>['style']; transparent?: boolean;
}) {
  const colors = useGuideColors();
  return <View style={[styles.frame, {
    backgroundColor: transparent ? 'transparent' : colors.surface, borderColor: focused ? colors.foreground : colors.borderStrong, borderRadius: radius,
    outlineColor: colors.foreground, outlineWidth: focused ? 1 : 0,
  }, style]}>{children}</View>;
}

// Use native font metrics so the hint and editable text have the same baseline.
const { fontFamily, fontSize } = typography.body;

export function GuideTextInput({ placeholder, compactPlaceholder, ...props }:
  Omit<ComponentProps<typeof TextInput>, 'style' | 'multiline'> & { compactPlaceholder: string }) {
  const colors = useGuideColors();
  const { fontScale, width } = useWindowDimensions();
  // UIKit shrinks a long hint to fit a single line, independently of the typed text.
  const hint = fontScale >= 1.4 || (fontScale > 1 && width < 360) ? compactPlaceholder : placeholder;
  return <TextInput {...props} accessibilityLanguage="uk" placeholder={hint} placeholderTextColor={colors.placeholder}
    selectionColor={colors.accent} underlineColorAndroid="transparent"
    style={[styles.input, {
      minHeight: Math.ceil(typography.body.lineHeight * fontScale) + 12, color: colors.foreground,
    }]} />;
}

export function GuideTextArea({ label, editable = true, ...props }: Pick<ComponentProps<typeof TextInput>,
  'value' | 'onChangeText' | 'placeholder' | 'maxLength' | 'editable'> & { label: string }) {
  const colors = useGuideColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <GuideText type="support" tone="foregroundMuted">{label}</GuideText>
      <GuideInputFrame focused={editable && focused} style={!editable && styles.disabled}>
        <TextInput {...props} accessibilityLabel={label} accessibilityLanguage="uk" multiline textAlignVertical="top"
          editable={editable} accessibilityState={{ disabled: !editable }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} placeholderTextColor={colors.placeholder}
          selectionColor={colors.accent} underlineColorAndroid="transparent"
          style={[styles.textArea, { color: colors.foreground }]} />
      </GuideInputFrame>
    </View>
  );
}

export type GuideChoice = { label: string; value: string; description?: string; disabled?: boolean };

function GuideSheet({ title, open, onClose, children, trigger }: {
  title: string; open: boolean; onClose: () => void; children: ReactNode; trigger?: RefObject<HostInstance | null>;
}) {
  const colors = useGuideColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [presentation, setPresentation] = useState({ open, reduced });
  // Android recreates the dialog when its animation type changes.
  if (Platform.OS === 'android' && presentation.open !== open) {
    setPresentation({ open, reduced: open ? reduced : presentation.reduced });
  }
  const reduceSheetMotion = Platform.OS === 'android' ? presentation.reduced : reduced;
  const heading = useRef<TextInstance>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const closing = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closing || Platform.OS === 'ios') return;
    const frame = requestAnimationFrame(() => focusGuideControl(trigger?.current ?? null));
    return () => cancelAnimationFrame(frame);
  }, [open, trigger]);
  return (
    <Modal transparent animationType={reduceSheetMotion ? 'none' : 'slide'} statusBarTranslucent visible={open} onRequestClose={onClose}
      onShow={() => { if (open) focusGuideControl(heading.current); }} onDismiss={() => {
        if (!open) focusGuideControl(trigger?.current ?? null);
      }}>
      <View style={styles.modal}>
        <Pressable accessible={false} focusable={false} style={[styles.backdrop, { backgroundColor: `${colors.foreground}99` }]} onPress={onClose} />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={styles.sheetHeader}>
            <GuideText type="sheetTitle" textRef={heading} style={styles.sheetTitle}>{title}</GuideText>
            <GuidePressable accessibilityRole="button" accessibilityLabel="Закрити" onPress={onClose}
              style={[styles.close, { backgroundColor: colors.background, borderColor: colors.iconButtonBorder, borderWidth: 1 }]}>
              <GuideIcon name={icons.close} size={20} />
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
  const trigger = useRef<HostInstance>(null);
  const selected = options.find(option => option.value === value);
  return (
    <>
      <View style={styles.fieldGroup}>
        <GuideText type="support" tone="foregroundMuted">{label}</GuideText>
        <GuidePressable ref={trigger} accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
          accessibilityState={{ disabled, expanded: open }} disabled={disabled}
          onPress={() => setOpen(true)} style={[styles.pressable, { backgroundColor: colors.surface, opacity: disabled ? 0.5 : 1 }]}>
          <GuideInputFrame focused={open} transparent style={styles.selectField}>
            <Text style={[typography.body, styles.selectValue, { color: selected ? colors.foreground : colors.placeholder }]}>
              {selected?.label ?? placeholder}
            </Text>
            <GuideIcon name="caret-down" color={colors.foregroundMuted} size={20} />
          </GuideInputFrame>
        </GuidePressable>
      </View>
      <GuideSheet title={label} open={open} trigger={trigger} onClose={() => setOpen(false)}>
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
      </GuideSheet>
    </>
  );
}

export function GuideDatePicker({ label, value, onChange, placeholder = 'Оберіть дату', minimumDate, maximumDate, disabled = false }: {
  label: string; value: Date | null; onChange: (value: Date) => void; placeholder?: string;
  minimumDate?: Date; maximumDate?: Date; disabled?: boolean;
}) {
  const colors = useGuideColors();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HostInstance>(null);
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
        <GuidePressable ref={trigger} accessibilityRole="button" accessibilityLabel={`${label}: ${value ? selectedText : placeholder}`}
          accessibilityState={{ disabled, expanded: open }} disabled={disabled}
          onPress={() => { setMonth(monthStart(value ?? new Date())); setOpen(true); }} style={[styles.pressable, { backgroundColor: colors.surface, opacity: disabled ? 0.5 : 1 }]}>
          <GuideInputFrame focused={open} transparent style={styles.selectField}>
            <GuideIcon name="calendar" color={colors.foregroundMuted} size={20} />
            <Text style={[typography.body, styles.selectValue, { color: value ? colors.foreground : colors.placeholder }]}>{selectedText}</Text>
          </GuideInputFrame>
        </GuidePressable>
      </View>
      <GuideSheet title={label} open={open} trigger={trigger} onClose={() => setOpen(false)}>
        <View style={styles.calendarHeader}>
          <GuidePressable accessibilityRole="button" accessibilityLanguage="uk" accessibilityLabel="Попередній місяць" onPress={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            style={[styles.monthButton, { backgroundColor: colors.background, borderColor: colors.iconButtonBorder }]}>
            <GuideIcon name={icons.back} />
          </GuidePressable>
          <Text style={[typography.item, styles.monthLabel, { color: colors.foreground }]}>{monthLabel}</Text>
          <GuidePressable accessibilityRole="button" accessibilityLanguage="uk" accessibilityLabel="Наступний місяць" onPress={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            style={[styles.monthButton, { backgroundColor: colors.background, borderColor: colors.iconButtonBorder }]}>
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
            return <CalendarDay key={key} date={date} selected={selected} disabled={!!unavailable} onPress={() => choose(day)} />;
          })}
        </View>
      </GuideSheet>
    </>
  );
}

function CalendarDay({ date, selected, disabled, onPress }: {
  date: Date; selected: boolean; disabled: boolean; onPress: () => void;
}) {
  const colors = useGuideColors();
  const opacity = useGuideTransition(selected ? 1 : 0);
  const day = date.getDate();
  return (
    <GuidePressable accessibilityRole="button" accessibilityLabel={new Intl.DateTimeFormat('uk-UA', { dateStyle: 'full' }).format(date)}
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
      style={[styles.dayCell, styles.dayButton]}>
      <Text style={[typography.support, { color: disabled ? colors.foregroundMuted : colors.foreground }]}>{day}</Text>
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.daySelection, {
        backgroundColor: colors.primaryButton, opacity,
      }]}>
        <Text style={[typography.support, { color: colors.onPrimaryButton }]}>{day}</Text>
      </Animated.View>
    </GuidePressable>
  );
}

export function GuideCheckbox({ label, value, onValueChange, disabled = false, style }: {
  label: string; value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean; style?: ComponentProps<typeof View>['style'];
}) {
  const colors = useGuideColors();
  const checkOpacity = useGuideTransition(value ? 1 : 0);
  return <View>
    <GuidePressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }}
      disabled={disabled} onPress={() => onValueChange(!value)}
      style={[styles.option, styles.checkboxRow, style, { opacity: disabled ? 0.55 : 1 }]}>
      <View style={[styles.checkbox, { borderColor: value ? colors.accent : colors.borderStrong, backgroundColor: value ? colors.button : colors.surface }]}>
        <Animated.View style={{ opacity: checkOpacity }}><GuideIcon name="check" color={colors.onAccent} size={16} /></Animated.View>
      </View>
      <GuideText type="support" style={styles.optionCopy}>{label}</GuideText>
    </GuidePressable>
    <View pointerEvents="none" style={[styles.checkboxDivider, { backgroundColor: colors.borderStrong }]} />
  </View>;
}

export function GuideSwitch({ value, onValueChange, accessibilityLabel, disabled, style }: {
  value: boolean; onValueChange: (value: boolean) => void; accessibilityLabel: string; disabled?: boolean;
  style?: ComponentProps<typeof Switch>['style'];
}) {
  const colors = useGuideColors();
  const ios = Platform.OS === 'ios';
  return <Switch accessibilityLabel={accessibilityLabel} accessibilityLanguage="uk" value={value} onValueChange={onValueChange} disabled={disabled}
    trackColor={{ false: colors.switchTrackOff, true: colors.accent }} thumbColor={colors.surface}
    ios_backgroundColor={colors.switchTrackOff} hitSlop={ios ? 8 : undefined}
    style={[styles.switch, !ios && styles.androidSwitch, style]} />;
}

export function GuideRadioMark({ selected }: { selected: boolean }) {
  const colors = useGuideColors();
  const opacity = useGuideTransition(selected ? 1 : 0);
  return <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.borderStrong }]}>
    <Animated.View style={[styles.radioDot, { backgroundColor: colors.accent, opacity }]} />
  </View>;
}

function monthStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
function dayStart(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }
function dayEnd(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1; }

const styles = StyleSheet.create({
  switch: { alignSelf: 'center' },
  androidSwitch: { minHeight: 44 },
  disabled: { opacity: 0.5 },
  frame: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, alignSelf: 'stretch', minWidth: 0, fontFamily, fontSize, padding: 0, includeFontPadding: false, textAlignVertical: 'center' },
  textArea: { flex: 1, minHeight: 120, fontFamily, fontSize, paddingVertical: 12, includeFontPadding: false },
  pressable: { alignSelf: 'stretch', borderRadius: defaultInputRadius },
  selectField: { width: '100%', gap: 8, paddingVertical: 8 },
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
  monthButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { textTransform: 'capitalize' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -16 },
  weekday: { width: '14.2857%', height: 36, textAlign: 'center', textAlignVertical: 'center' },
  dayCell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayButton: { borderRadius: 24, overflow: 'hidden' },
  daySelection: { position: 'absolute', top: 4, right: 4, bottom: 4, left: 4, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  checkboxRow: { paddingHorizontal: 0, borderBottomWidth: 0 },
  checkboxDivider: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
