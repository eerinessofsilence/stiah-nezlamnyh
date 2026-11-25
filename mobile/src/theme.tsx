import Storage from 'expo-sqlite/kv-store';
import { createContext, type ReactNode, useContext, useLayoutEffect, useState } from 'react';
import { Alert, Appearance, useColorScheme } from 'react-native';

const light = {
  background: '#f0f0e6',
  surface: '#ffffff',
  surfaceMuted: '#d7dfc9',
  surfaceSoft: '#e1e7d6',
  surfaceTileIcon: '#f1f3eb',
  iconButtonBorder: '#626c56',
  border: '#c6ccbb',
  borderStrong: '#626c56',
  foreground: '#202319',
  foregroundMuted: '#404737',
  placeholder: '#404737e6',
  accent: '#344b22',
  button: '#455830',
  onAccent: '#ffffff',
  switchTrackOff: '#626c56',
  primaryButton: '#20280f',
  primaryButtonPressed: '#343e20',
  onPrimaryButton: '#fbfbf6',
  feature: '#20280f',
  featurePressed: '#343e20',
  onFeature: '#fbfbf6',
};

const dark: typeof light = {
  background: '#1c2118',
  surface: '#282e22',
  surfaceMuted: '#3f4934',
  surfaceSoft: '#343e2d',
  surfaceTileIcon: '#343e2d',
  iconButtonBorder: '#46513d',
  border: '#46513d',
  borderStrong: '#8c9879',
  foreground: '#f0f2e8',
  foregroundMuted: '#bdc6b1',
  placeholder: '#bdc6b1e6',
  accent: '#c5d5b2',
  button: '#b9c6a3',
  onAccent: '#25331c',
  switchTrackOff: '#3f4934',
  primaryButton: '#b9c6a3',
  primaryButtonPressed: '#d1dbbf',
  onPrimaryButton: '#25331c',
  feature: '#11180d',
  featurePressed: '#25331c',
  onFeature: '#f0f2e8',
};

const storageKey = 'nezlamnyi-color-scheme';
type ThemePreference = 'system' | 'light' | 'dark';
const GuideAppearance = createContext<{
  darkMode: boolean;
  preference: ThemePreference;
  setPreference: (value: string) => void;
} | null>(null);

function loadThemePreference(): ThemePreference {
  try {
    const value = Storage.getItemSync(storageKey);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function GuideThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(loadThemePreference);
  const colorScheme = useColorScheme();
  const darkMode = (preference === 'system' ? colorScheme : preference) === 'dark';

  useLayoutEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? 'auto' : preference);
  }, [preference]);

  function savePreference(value: string) {
    if (value !== 'system' && value !== 'light' && value !== 'dark') return;
    try {
      Storage.setItemSync(storageKey, value);
      setPreference(value);
    } catch {
      Alert.alert('Не вдалося зберегти тему', 'Спробуйте ще раз.');
    }
  }

  return <GuideAppearance.Provider value={{ darkMode, preference, setPreference: savePreference }}>{children}</GuideAppearance.Provider>;
}

export function useGuideAppearance() {
  const appearance = useContext(GuideAppearance);
  if (!appearance) throw new Error('GuideThemeProvider is required');
  return appearance;
}

export function useGuideColors() {
  return useGuideAppearance().darkMode ? dark : light;
}
