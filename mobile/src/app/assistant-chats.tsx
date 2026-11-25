import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, type HostInstance, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAssistantChats } from '../assistant-chat-state';
import { assistantChatTitle, type ChatMenuBounds, chatMenuPosition, chatTitleLimit, listAssistantChats } from '../assistant-chats';
import { GuideInputFrame, GuideTextInput } from '../form-controls';
import { GuideBackButton, GuideButton, guideContentInset, guideContentMaxWidth, GuideIcon, GuideIconButton, GuidePanel, GuidePressable, GuideScreen, GuideText } from '../guide';
import { focusGuideControl } from '../guide-motion';
import { useGuideColors } from '../theme';

export default function AssistantChatsScreen() {
  const router = useRouter();
  const colors = useGuideColors();
  const insets = useSafeAreaInsets();
  const { activeId, chats, openChat, startChat, updateChat, deleteChat } = useAssistantChats();
  const [menu, setMenu] = useState<{ id: number; anchor: ChatMenuBounds }>();
  const [renameId, setRenameId] = useState<number>();
  const [title, setTitle] = useState('');
  const [titleFocused, setTitleFocused] = useState(false);
  const root = useRef<HostInstance>(null);
  const size = useRef({ width: 0, height: 0 });
  const triggers = useRef(new Map<number, HostInstance>());
  const listed = listAssistantChats(chats);
  const selected = chats.find(chat => chat.id === menu?.id);
  const renaming = renameId !== undefined;

  const restoreFocus = useCallback((id: number) => {
    requestAnimationFrame(() => focusGuideControl(triggers.current.get(id) ?? null));
  }, []);

  const closeMenu = useCallback(() => {
    setMenu(undefined);
    if (menu) restoreFocus(menu.id);
  }, [menu, restoreFocus]);

  const cancelRename = useCallback(() => {
    Keyboard.dismiss();
    setRenameId(undefined);
    setTitleFocused(false);
  }, []);

  useFocusEffect(useCallback(() => {
    if (!menu && !renaming) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menu) closeMenu();
      else cancelRename();
      return true;
    });
    return () => subscription.remove();
  }, [cancelRename, closeMenu, menu, renaming]));

  function closeScreen() {
    router.dismissTo('/(tabs)/assistant');
  }

  function showActions(id: number) {
    const container = root.current;
    if (!container) return;
    triggers.current.get(id)?.measureLayout(container, (left, top, width, height) => {
      setMenu({ id, anchor: { left, top, right: left + width, bottom: top + height } });
    });
  }

  function saveName() {
    const name = title.trim();
    if (renameId === undefined || !name) return;
    updateChat(renameId, chat => ({ ...chat, title: name }));
    cancelRename();
  }

  if (renaming) return (
    <GuideScreen adjustForKeyboard title="Перейменувати чат" titleAction={<GuideBackButton label="Назад" onPress={cancelRename} />}>
      <GuideInputFrame focused={titleFocused}>
        <GuideTextInput accessibilityLabel="Назва чату" placeholder="Назва чату" compactPlaceholder="Назва"
          value={title} onChangeText={setTitle} maxLength={chatTitleLimit} returnKeyType="done"
          onFocus={() => setTitleFocused(true)} onBlur={() => setTitleFocused(false)} onSubmitEditing={saveName} />
      </GuideInputFrame>
      <GuideButton label="Зберегти назву" variant="primary" disabled={!title.trim()} onPress={saveName} />
      <GuideButton label="Скасувати" onPress={cancelRename} />
    </GuideScreen>
  );

  const header = (
    <View style={styles.header}>
      <GuideBackButton label="Назад" onPress={closeScreen} />
      <GuideText type="title" style={styles.chatTitle}>Історія чатів</GuideText>
      <GuideIconButton icon="plus" label="Новий чат" onPress={() => { startChat(); closeScreen(); }} />
    </View>
  );

  return (
    <View ref={root} collapsable={false} style={styles.flex} onLayout={({ nativeEvent: { layout } }) => {
      if (layout.width === size.current.width && layout.height === size.current.height) return;
      size.current = layout;
      setMenu(undefined);
    }}>
      <View style={styles.flex} accessibilityElementsHidden={!!selected}
        importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}>
        <GuideScreen fixedHeader={header}>
          {listed.length === 0 && <GuidePanel><GuideText type="support">Поки що немає чатів.</GuideText></GuidePanel>}
          {listed.map(chat => {
            const label = assistantChatTitle(chat);
            const active = chat.id === activeId;
            return <GuidePanel key={chat.id} tone={active ? 'surfaceSoft' : 'surface'} style={styles.chat}>
              <GuidePressable accessibilityRole="button" accessibilityLabel={chat.pinned ? `Закріплений чат. ${label}` : label}
                accessibilityState={{ selected: active }} accessibilityHint="Відкриває чат. Утримуйте для дій."
                onPress={() => { openChat(chat.id); closeScreen(); }} onLongPress={() => showActions(chat.id)} style={styles.chatMain}>
                {chat.pinned && <GuideIcon name="push-pin-fill" size={18} color={colors.accent} />}
                <GuideText type="item" style={styles.chatTitle}>{label}</GuideText>
              </GuidePressable>
              <GuideIconButton icon="dots-three-vertical" iconSize={24} label={`Дії з чатом «${label}»`} ref={instance => {
                if (instance) triggers.current.set(chat.id, instance);
                else triggers.current.delete(chat.id);
              }} onPress={() => showActions(chat.id)} />
            </GuidePanel>;
          })}
        </GuideScreen>
      </View>
      {menu && selected && <ChatActionsPopover anchor={menu.anchor} bounds={{
        left: insets.left + 12, top: insets.top + 8, right: size.current.width - insets.right - 12,
        bottom: size.current.height - insets.bottom - 8,
      }} actions={[
        { label: 'Перейменувати', onPress: () => {
          setTitle(assistantChatTitle(selected));
          setRenameId(selected.id);
          setMenu(undefined);
        } },
        { label: selected.pinned ? 'Відкріпити' : 'Закріпити', onPress: () => {
          updateChat(selected.id, chat => ({ ...chat, pinned: !chat.pinned }));
          closeMenu();
        } },
        { label: 'Видалити', onPress: () => {
          setMenu(undefined);
          Alert.alert('Видалити чат?', assistantChatTitle(selected), [
            { text: 'Скасувати', style: 'cancel', onPress: () => restoreFocus(selected.id) },
            { text: 'Видалити', style: 'destructive', onPress: () => deleteChat(selected.id) },
          ], { cancelable: true, onDismiss: () => restoreFocus(selected.id) });
        } },
      ]} onClose={closeMenu} />}
    </View>
  );
}

function ChatActionsPopover({ anchor, bounds, actions, onClose }: {
  anchor: ChatMenuBounds;
  bounds: ChatMenuBounds;
  actions: { label: string; onPress: () => void }[];
  onClose: () => void;
}) {
  const colors = useGuideColors();
  const [height, setHeight] = useState(0);
  const firstAction = useRef<HostInstance>(null);
  const ready = height > 0;
  const position = chatMenuPosition(anchor, bounds, height);

  useEffect(() => {
    if (ready) focusGuideControl(firstAction.current);
  }, [ready]);

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal onAccessibilityEscape={onClose}>
      <Pressable accessible={false} focusable={false} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View onLayout={event => setHeight(event.nativeEvent.layout.height)}
        style={[styles.menu, position, { opacity: ready ? 1 : 0, backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
        <ScrollView style={{ maxHeight: Math.max(0, position.maxHeight - 2) }} keyboardShouldPersistTaps="handled">
          {actions.map(({ label, onPress }, index) => <GuidePressable key={label} ref={index === 0 ? firstAction : undefined}
            accessibilityRole="menuitem" accessibilityLabel={label} onPress={onPress}
            style={[styles.menuItem, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <GuideText type="item">{label}</GuideText>
          </GuidePressable>)}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8,
    width: '100%', maxWidth: guideContentMaxWidth, paddingTop: 12, paddingHorizontal: guideContentInset,
  },
  chat: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8 },
  chatMain: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10 },
  chatTitle: { flex: 1 },
  menu: { position: 'absolute', borderRadius: 12, borderWidth: 1, overflow: 'hidden', boxShadow: '0px 4px 16px #00000028' },
  menuItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
});
