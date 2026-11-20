import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputInstance, View } from 'react-native';

import { GuideIcon, icons } from './guide';
import { useGuideState } from './guide-state';
import { useGuideColors } from './theme';
import { typography } from './typography';

export function SearchField({ value, onChange, label = 'Пошук послуг' }: {
  value?: string; onChange?: (value: string) => void; label?: string;
} = {}) {
  const state = useGuideState();
  const query = value ?? state.query;
  const setQuery = onChange ?? state.setQuery;
  const colors = useGuideColors();
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: focused ? colors.ink : colors.lineStrong }]}>
      <GuideIcon name={{ ios: 'magnifyingglass', android: 'search' }} color={colors.muted} size={20} />
      <TextInput
        ref={input}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        placeholder={label}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={160}
        style={[styles.input, { fontFamily: typography.body.fontFamily, fontSize: typography.body.fontSize, color: colors.ink }]}
      />
      {query !== '' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Очистити пошук"
          android_ripple={{ color: colors.line }}
          style={styles.clear}
          onPress={() => { setQuery(''); input.current?.focus(); }}
        >
          <GuideIcon name={icons.close} color={colors.muted} size={16} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingLeft: 12, gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 0, paddingRight: 8, textAlignVertical: 'center', includeFontPadding: false },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
