import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { NativeTabs } from 'expo-router/native-tabs';
import { Animated, StyleSheet, View } from 'react-native';

import { GuideStateIcon, GuidePressable, hasNativeHomeTabs } from '../../guide';
import { guideIconSources } from '../../guide-icons';
import { useGuideTransition } from '../../guide-motion';
import { guideTabs } from '../../guide-tabs';
import { useGuideColors } from '../../theme';
import { typography } from '../../typography';

export default function TabsLayout() {
  const colors = useGuideColors();

  if (!hasNativeHomeTabs) {
    return (
      <Tabs backBehavior="initialRoute" screenOptions={{ headerShown: false }} tabBar={renderHomeTabs}>
        {guideTabs.map(({ name }) => <Tabs.Screen key={name} name={name} />)}
      </Tabs>
    );
  }

  return (
    <NativeTabs activityEnabled backBehavior="initialRoute" tintColor={colors.accent}
      labelStyle={{ default: { fontWeight: '600' }, selected: { fontWeight: '700' } }}
      iconColor={{ default: colors.foregroundMuted, selected: colors.accent }}
      minimizeBehavior="never">
      {guideTabs.map(({ name, label, icon, selectedIcon }) => (
        <NativeTabs.Trigger key={name} name={name} labelVisibilityMode="labeled">
          <NativeTabs.Trigger.Label>{label.replace(' ', '\u00a0')}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon src={{ default: guideIconSources[icon], selected: guideIconSources[selectedIcon] }}
            renderingMode="template" />
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
        const tab = guideTabs.find(({ name }) => name === route.name);
        if (!tab) return null;
        const selected = index === state.index;

        return (
          <GuidePressable key={route.key} accessibilityRole="tab" accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.tab}>
            <HomeTabLabel tab={tab} selected={selected} />
          </GuidePressable>
        );
      })}
    </View>
  );
}

function HomeTabLabel({ tab, selected }: { tab: typeof guideTabs[number]; selected: boolean }) {
  const colors = useGuideColors();
  const progress = useGuideTransition(selected ? 1 : 0);
  const color = progress.interpolate({ inputRange: [0, 1], outputRange: [colors.foregroundMuted, colors.accent] });
  return <>
    <GuideStateIcon size={24} name={tab.icon} selectedName={tab.selectedIcon} selected={selected}
      color={colors.foregroundMuted} selectedColor={colors.accent} />
    <Animated.Text maxFontSizeMultiplier={2}
      style={[typography.number, styles.label, selected && styles.selectedLabel, { color }]}>
      {tab.label}
    </Animated.Text>
  </>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', minHeight: 64, gap: 4, paddingVertical: 12, paddingHorizontal: 2 },
  label: { textAlign: 'center' },
  selectedLabel: { fontFamily: 'GuideBold' },
});
