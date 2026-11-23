import { type RefObject, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, type TextInputInstance, View } from 'react-native';

import { GuideIcon, GuidePressable, icons } from './guide';
import { GuideInputFrame, GuideInputPlaceholder } from './form-controls';
import { useGuideState } from './guide-state';
import { useGuideTransition } from './guide-motion';
import { useGuideColors } from './theme';
import { typography } from './typography';

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
    <GuideInputFrame focused={focused} radius={8} style={styles.field}>
      <View style={styles.icon}>
        <GuideIcon name="magnifying-glass" color={colors.foregroundMuted} size={20} />
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          ref={input}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          accessibilityLanguage="uk"
          selectionColor={colors.accent}
          underlineColorAndroid="transparent"
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={160}
          style={[typography.body, styles.input, { color: colors.foreground }]}
        />
        {query === '' && <GuideInputPlaceholder>{label}</GuideInputPlaceholder>}
      </View>
      <Animated.View style={{ opacity: clearOpacity }} pointerEvents={canClear ? 'auto' : 'none'}
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
  field: { paddingLeft: 12, paddingRight: 4, gap: 8 },
  icon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, minWidth: 0, minHeight: 50, justifyContent: 'center' },
  input: { flex: 1, alignSelf: 'stretch', minWidth: 0, minHeight: 50, paddingTop: 0, paddingBottom: 10, paddingRight: 8, textAlignVertical: 'center', includeFontPadding: false },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, overflow: 'hidden' },
});
