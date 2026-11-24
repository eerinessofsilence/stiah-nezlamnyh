import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuideButton, guideContentInset, guideContentMaxWidth, GuideScreen, GuideText } from './guide';
import type { GuideProfile } from './guide-profile';
import { useGuideState } from './guide-state';
import { StatusChoices } from './status-choices';
import { GuideInputFrame, GuideTextInput } from './form-controls';
import { useGuideColors } from './theme';

export function ProfileForm({ editing = false }: { editing?: boolean }) {
  const router = useRouter();
  const colors = useGuideColors();
  const { profile, saveProfile } = useGuideState();
  const [name, setName] = useState(profile?.name ?? '');
  const [statusId, setStatusId] = useState<GuideProfile['statusId'] | null>(profile?.statusId ?? null);
  const [focused, setFocused] = useState(false);

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
      <GuideInputFrame focused={focused}><GuideTextInput
        accessibilityLabel="Ваше ім’я, необов’язково"
        placeholder="Необов’язково"
        compactPlaceholder="Ім’я"
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="given-name"
        returnKeyType="done"
        value={name}
        onChangeText={setName}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      /></GuideInputFrame>
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
      <StatusChoices selectedId={statusId} variant={editing ? 'rows' : 'tiles'}
        onChoose={id => { setStatusId(id); Keyboard.dismiss(); }} />
      {editing && save}
    </GuideScreen>
  );

  if (editing) return form;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}>
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
  footer: { width: '100%', maxWidth: guideContentMaxWidth, alignSelf: 'center', paddingHorizontal: guideContentInset, paddingVertical: 8 },
});
