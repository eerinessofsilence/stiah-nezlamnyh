import { Stack, type NativeStackNavigationOptions } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';

import { AssistantChatProvider } from '../assistant-chat-state';
import { AssistantVoiceProvider } from '../assistant-voice-session';
import { GuideLaunch } from '../guide-launch';
import { GuideMotionProvider, useReducedMotion } from '../guide-motion';
import { GuideProvider } from '../guide-state';
import { GuideThemeProvider, useGuideAppearance, useGuideColors } from '../theme';
import { guideFonts } from '../typography';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const [loaded, error] = useFonts(guideFonts);
  const ready = loaded || !!error;

  return (
    <GuideThemeProvider>
      <GuideMotionProvider>
        <GuideLaunch ready={ready}><GuideNavigation /></GuideLaunch>
      </GuideMotionProvider>
    </GuideThemeProvider>
  );
}

function GuideNavigation() {
  const colors = useGuideColors();
  const { darkMode } = useGuideAppearance();
  const reduced = useReducedMotion();
  const theme = darkMode ? DarkTheme : DefaultTheme;
  const pageOptions: NativeStackNavigationOptions = { headerShown: false, animation: reduced ? 'none' : 'default' };
  const sheetOptions: NativeStackNavigationOptions = {
    headerShown: false,
    presentation: 'formSheet',
    sheetAllowedDetents: [0.9, 1],
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    sheetExpandsWhenScrolledToEdge: true,
    scrollEdgeEffects: { top: 'soft', bottom: 'soft' },
    contentStyle: { backgroundColor: colors.surface },
  };

  return (
    <ThemeProvider value={{
      ...theme,
      colors: { ...theme.colors, background: colors.background, card: colors.surface, text: colors.foreground, primary: colors.accent },
    }}>
      <GuideProvider>
        <AssistantChatProvider>
          <AssistantVoiceProvider>
            <Stack screenOptions={{ statusBarStyle: darkMode ? 'light' : 'dark' }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false, scrollEdgeEffects: { top: 'hidden', bottom: 'soft' } }} />
              <Stack.Screen name="assistant-chats" options={pageOptions} />
              <Stack.Screen name="assistant-voice" options={{ ...sheetOptions, sheetAllowedDetents: [0.34, 0.5, 1],
                sheetInitialDetentIndex: 1, sheetExpandsWhenScrolledToEdge: false }} />
              <Stack.Screen name="contacts" options={pageOptions} />
              <Stack.Screen name="about" options={pageOptions} />
              <Stack.Screen name="notifications" options={pageOptions} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={sheetOptions} />
              <Stack.Screen name="services-modal" options={sheetOptions} />
              <Stack.Screen name="service/[id]" options={pageOptions} />
            </Stack>
          </AssistantVoiceProvider>
        </AssistantChatProvider>
      </GuideProvider>
    </ThemeProvider>
  );
}
