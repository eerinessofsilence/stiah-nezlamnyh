import { Stack, type NativeStackNavigationOptions } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';

import { GuideLaunch } from '../guide-launch';
import { GuideProvider } from '../guide-state';
import { GuideThemeProvider, useGuideAppearance, useGuideColors } from '../theme';
import { guideFonts } from '../typography';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const [loaded, error] = useFonts(guideFonts);
  const ready = loaded || !!error;

  return (
    <GuideThemeProvider>
      <GuideLaunch ready={ready}>{ready && <GuideNavigation />}</GuideLaunch>
    </GuideThemeProvider>
  );
}

function GuideNavigation() {
  const colors = useGuideColors();
  const { darkMode } = useGuideAppearance();
  const theme = darkMode ? DarkTheme : DefaultTheme;
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
        <Stack screenOptions={{ statusBarStyle: darkMode ? 'light' : 'dark' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, scrollEdgeEffects: { top: 'hidden', bottom: 'soft' } }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={sheetOptions} />
          <Stack.Screen name="services-modal" options={sheetOptions} />
          <Stack.Screen name="service/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        </Stack>
      </GuideProvider>
    </ThemeProvider>
  );
}
