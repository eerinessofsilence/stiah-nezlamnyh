import { Redirect, Tabs, usePathname } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { NativeTabs } from 'expo-router/native-tabs';
import { StyleSheet, Text, View } from 'react-native';

import { GuideIcon, GuidePressable, hasNativeHomeTabs } from '../../guide';
import { guideIconSources } from '../../guide-icons';
import { useGuideState } from '../../guide-state';
import { useGuideColors } from '../../theme';
import { typography } from '../../typography';

const tabs = [
  { name: 'index', label: 'Головна', icon: 'house', selectedIcon: 'house-fill' },
  { name: 'services', label: 'Послуги', icon: 'squares-four', selectedIcon: 'squares-four-fill' },
  { name: 'assistant', label: 'Помічник', icon: 'assistant', selectedIcon: 'assistant-fill' },
  { name: 'contacts', label: 'Контакти', icon: 'users', selectedIcon: 'users-fill' },
  { name: 'menu', label: 'Про гід', icon: 'clipboard-text', selectedIcon: 'clipboard-text' },
] as const;

export default function TabsLayout() {
  const colors = useGuideColors();
  const { profile } = useGuideState();
  const pathname = usePathname();

  if (!profile && pathname === '/') return <Redirect href="/welcome" />;

  if (!hasNativeHomeTabs) {
    return (
      <Tabs backBehavior="initialRoute" screenOptions={{ headerShown: false }} tabBar={renderHomeTabs}>
        {tabs.map(({ name }) => <Tabs.Screen key={name} name={name} />)}
      </Tabs>
    );
  }

  return (
    <NativeTabs activityEnabled backBehavior="initialRoute" tintColor={colors.accent}
      iconColor={{ default: colors.foregroundMuted, selected: colors.accent }}
      minimizeBehavior="never">
      {tabs.map(({ name, label, icon, selectedIcon }) => (
        <NativeTabs.Trigger key={name} name={name} labelVisibilityMode="labeled">
          <NativeTabs.Trigger.Label>{label.replace(' ', '\u00a0')}</NativeTabs.Trigger.Label>
          {name === 'menu' ? <NativeTabs.Trigger.Icon sf={{ default: 'info.circle', selected: 'info.circle.fill' }} /> :
            <NativeTabs.Trigger.Icon src={{ default: guideIconSources[icon], selected: guideIconSources[selectedIcon] }}
              renderingMode="template" />}
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

function renderHomeTabs(props: BottomTabBarProps) {
  return <HomeTabs {...props} />;
}

function HomeTabs({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const colors = useGuideColors();

  return (
    <View role="tablist" style={[styles.bar, {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    }]}>
      {state.routes.map((route, index) => {
        const tab = tabs.find(({ name }) => name === route.name);
        if (!tab) return null;
        const selected = index === state.index;
        const color = selected ? colors.accent : colors.foregroundMuted;

        return (
          <GuidePressable key={route.key} accessibilityRole="tab" accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [styles.tab, pressed && { backgroundColor: colors.surfaceMuted }]}>
            <GuideIcon size={24} name={selected ? tab.selectedIcon : tab.icon} color={color} />
            <Text maxFontSizeMultiplier={2}
              style={[selected ? typography.number : typography.meta, styles.label, { color }]}>
              {tab.label}
            </Text>
          </GuidePressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', minHeight: 64, gap: 4, paddingVertical: 12, paddingHorizontal: 2 },
  label: { textAlign: 'center' },
});
