import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { hideAsync, preventAutoHideAsync } from 'expo-splash-screen';
import { useEffect } from 'react';

import { GuideProvider } from '../guide-state';
import { GuideThemeProvider, useGuideAppearance, useGuideColors } from '../theme';
import { guideFonts } from '../typography';

export const unstable_settings = { initialRouteName: '(tabs)' };
void preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts(guideFonts);

  useEffect(() => {
    if (loaded || error) void hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return <GuideThemeProvider><GuideNavigation /></GuideThemeProvider>;
}

function GuideNavigation() {
  const colors = useGuideColors();
  const { darkMode } = useGuideAppearance();
  const theme = darkMode ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={{
      ...theme,
      colors: { ...theme.colors, background: colors.canvas, card: colors.surface, text: colors.ink, primary: colors.accent },
    }}>
      <GuideProvider>
        <Stack screenOptions={{ statusBarStyle: darkMode ? 'light' : 'dark' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, scrollEdgeEffects: { top: 'hidden', bottom: 'soft' } }} />
          <Stack.Screen name="service/[id]" options={{
            headerShown: false,
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 28,
            sheetExpandsWhenScrolledToEdge: true,
            scrollEdgeEffects: { top: 'soft', bottom: 'soft' },
            contentStyle: { backgroundColor: colors.surface },
          }} />
        </Stack>
      </GuideProvider>
    </ThemeProvider>
  );
}
