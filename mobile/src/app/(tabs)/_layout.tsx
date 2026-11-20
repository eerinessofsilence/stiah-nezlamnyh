import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { useGuideColors } from '../../theme';

export default function TabsLayout() {
  const colors = useGuideColors();
  const ios = Platform.OS === 'ios';
  const labelSize = ios ? 11 : 12;

  return (
    <NativeTabs activityEnabled backBehavior="initialRoute" tintColor={colors.accent}
      backgroundColor={ios ? undefined : colors.surface}
      labelStyle={{
        default: { fontSize: labelSize, fontWeight: ios ? '600' : '700' },
        selected: { fontSize: labelSize, fontWeight: '700' },
      }}
      labelVisibilityMode="labeled" minimizeBehavior="never">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Головна</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="services">
        <NativeTabs.Trigger.Label>Послуги</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="grid_view" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="assistant">
        <NativeTabs.Trigger.Label>Помічник</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon renderingMode="template" src={{
          default: require('../../../assets/tabs/assistant.png'),
          selected: require('../../../assets/tabs/assistant-selected.png'),
        }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="contacts">
        <NativeTabs.Trigger.Label>Контакти</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }}
          md={{ default: 'people', selected: 'people' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="menu">
        <NativeTabs.Trigger.Label>Про гід</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'info.circle', selected: 'info.circle.fill' }} md="info" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
