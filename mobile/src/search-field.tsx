import { type RefObject, useRef, useState } from 'react';
import { Animated, StyleSheet, type TextInputInstance } from 'react-native';

import { GuideIcon, GuidePressable, icons } from './guide';
import { GuideInputFrame, GuideTextInput } from './form-controls';
import { useGuideState } from './guide-state';
import { useGuideTransition } from './guide-motion';
import { useGuideColors } from './theme';

export function SearchField({ value, onChange, inputRef, label = 'Пошук послуг' }: {
  value?: string; onChange?: (value: string) => void; inputRef?: RefObject<TextInputInstance | null>; label?: string;
} = {}) {
  const state = useGuideState();
  const query = value ?? state.query;
  const setQuery = onChange ?? state.setQuery;
  const colors = useGuideColors();
  const localInput = useRef<TextInputInstance>(null);
  const input = inputRef ?? localInput;
  const [focused, setFocused] = useState(false);
  const canClear = query !== '';
  const clearOpacity = useGuideTransition(canClear ? 1 : 0);

  return (
    <GuideInputFrame focused={focused} radius={10} style={styles.field}>
      <GuideIcon name="magnifying-glass" color={colors.foregroundMuted} size={20} />
      <GuideTextInput
        ref={input}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        placeholder={label}
        compactPlaceholder="Пошук"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={160}
      />
      <Animated.View style={{ opacity: clearOpacity, display: canClear ? 'flex' : 'none' }} pointerEvents={canClear ? 'auto' : 'none'}
        accessibilityElementsHidden={!canClear} importantForAccessibility={canClear ? 'auto' : 'no-hide-descendants'}>
        <GuidePressable
          accessibilityRole="button"
          accessibilityLabel="Очистити пошук"
          disabled={!canClear}
          focusable={canClear}
          style={styles.clear}
          onPress={() => { setQuery(''); input.current?.focus(); }}
        >
          <GuideIcon name={icons.close} color={colors.foregroundMuted} size={16} />
        </GuidePressable>
      </Animated.View>
    </GuideInputFrame>
  );
}

const styles = StyleSheet.create({
  field: { paddingLeft: 16, paddingRight: 8, gap: 8 },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden' },
});
