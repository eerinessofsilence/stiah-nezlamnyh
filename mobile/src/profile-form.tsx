import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuideButton, guideContentInset, guideContentMaxWidth, GuideIcon, GuideScreen, GuideText } from './guide';
import { type GuideProfile, statuses } from './guide-profile';
import { useGuideState } from './guide-state';
import { useGuideColors } from './theme';
import { typography } from './typography';

export function ProfileForm({ editing = false }: { editing?: boolean }) {
  const router = useRouter();
  const colors = useGuideColors();
  const { profile, saveProfile } = useGuideState();
  const { width, fontScale } = useWindowDimensions();
  const [name, setName] = useState(profile?.name ?? '');
  const [statusId, setStatusId] = useState<GuideProfile['statusId'] | null>(profile?.statusId ?? null);
  const [focused, setFocused] = useState(false);
  const twoColumns = width >= 340 && fontScale < 1.4;

  function close() {
    Keyboard.dismiss();
    router.dismissTo('/(tabs)');
  }

  function submit() {
    if (statusId && saveProfile({ name: name.trim(), statusId })) close();
  }

  const nameField = (
    <View style={styles.nameField}>
      <GuideText type="item">Ваше ім’я</GuideText>
      <TextInput
        accessibilityLabel="Ваше ім’я"
        placeholder="Необов’язково"
        placeholderTextColor={colors.muted}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="given-name"
        returnKeyType="done"
        value={name}
        onChangeText={setName}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[typography.body, styles.input, {
          backgroundColor: colors.surface, borderColor: focused ? colors.ink : colors.lineStrong, color: colors.ink,
        }]}
      />
    </View>
  );

  const save = (
    <GuideButton label={editing ? 'Зберегти' : 'Продовжити'} variant="primary" fullWidth
      disabled={!statusId} accessibilityState={{ disabled: !statusId }} onPress={submit} />
  );
  const form = (
    <GuideScreen title={editing ? 'Змінити статус' : 'Налаштуйте гід'} sheet={editing} adjustForKeyboard={editing}>
      {!editing && nameField}
      {!editing && <GuideText type="section">Ваш статус</GuideText>}
      <View style={styles.statusGrid}>
        {statuses.map(item => {
          const selected = item.id === statusId;
          return (
            <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected }}
              accessibilityLabel={item.title} onPress={() => { setStatusId(item.id); Keyboard.dismiss(); }}
              android_ripple={{ color: colors.line }}
              style={({ pressed }) => [styles.statusTile, !twoColumns && styles.statusTileFull, editing && styles.statusRow, {
                backgroundColor: pressed || selected ? colors.surfaceMuted : colors.surface,
                borderColor: selected ? colors.lineStrong : colors.line,
              }]}>
              <View style={styles.statusTileTop}>
                <View style={[styles.statusIcon, { backgroundColor: selected ? colors.surface : colors.surfaceMuted }]}>
                  <GuideIcon name={item.icon} size={22} />
                </View>
                {editing && <GuideText type="item" style={styles.rowTitle}>{item.title}</GuideText>}
                <GuideIcon name={selected ? { ios: 'checkmark', android: 'check' } : { ios: 'circle', android: 'radio_button_unchecked' }}
                  color={colors.muted} />
              </View>
              {!editing && <GuideText type="tile">{item.title}</GuideText>}
            </Pressable>
          );
        })}
      </View>
      {editing && save}
    </GuideScreen>
  );

  if (editing) return form;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.canvas }]}>
      {form}
      <SafeAreaView edges={['left', 'right', 'bottom']}>
        <View style={styles.footer}>{save}</View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  nameField: { gap: 8, marginBottom: 4 },
  input: { minHeight: 48, paddingVertical: 0, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8, includeFontPadding: false, textAlignVertical: 'center' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusTile: { width: '48%', flexGrow: 1, minHeight: 116, padding: 16, gap: 8, borderWidth: 1, borderRadius: 16,
    justifyContent: 'space-between', overflow: 'hidden' },
  statusTileFull: { width: '100%' },
  statusTileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusRow: { width: '100%', minHeight: 56, borderRadius: 12, paddingVertical: 8, justifyContent: 'center' },
  rowTitle: { flex: 1, marginHorizontal: 12 },
  statusIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  footer: { width: '100%', maxWidth: guideContentMaxWidth, alignSelf: 'center', paddingHorizontal: guideContentInset, paddingVertical: 8 },
});
