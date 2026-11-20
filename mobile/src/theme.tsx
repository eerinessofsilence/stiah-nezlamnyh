import Storage from 'expo-sqlite/kv-store';
import { createContext, type ReactNode, useContext, useLayoutEffect, useState } from 'react';
import { Alert, Appearance } from 'react-native';

const light = {
  canvas: '#f0f0e6',
  surface: '#fbfbf6',
  surfaceMuted: '#dfe3d2',
  soft: '#e4e7d8',
  line: '#e2e3d8',
  lineStrong: '#899078',
  ink: '#202319',
  muted: '#59604f',
  accent: '#566143',
  button: '#a0aa8c',
  onAccent: '#20280f',
  primaryButton: '#20280f',
  onPrimaryButton: '#fbfbf6',
  feature: '#20280f',
  onFeature: '#fbfbf6',
};

const dark: typeof light = {
  canvas: '#1c2118',
  surface: '#282e22',
  surfaceMuted: '#3f4934',
  soft: '#343e2d',
  line: '#46513d',
  lineStrong: '#869276',
  ink: '#f0f2e8',
  muted: '#bdc6b1',
  accent: '#c5d5b2',
  button: '#b9c6a3',
  onAccent: '#25331c',
  primaryButton: '#b9c6a3',
  onPrimaryButton: '#25331c',
  feature: '#11180d',
  onFeature: '#f0f2e8',
};

const storageKey = 'nezlamnyi-color-scheme';
const GuideAppearance = createContext<{
  darkMode: boolean;
  setDarkMode: (enabled: boolean) => void;
} | null>(null);

function loadDarkMode() {
  try {
    return Storage.getItemSync(storageKey) === 'dark';
  } catch {
    return false;
  }
}

export function GuideThemeProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(loadDarkMode);

  useLayoutEffect(() => {
    Appearance.setColorScheme(darkMode ? 'dark' : 'light');
  }, [darkMode]);

  function saveDarkMode(enabled: boolean) {
    try {
      Storage.setItemSync(storageKey, enabled ? 'dark' : 'light');
      setDarkMode(enabled);
    } catch {
      Alert.alert('Не вдалося зберегти тему', 'Спробуйте ще раз.');
    }
  }

  return <GuideAppearance.Provider value={{ darkMode, setDarkMode: saveDarkMode }}>{children}</GuideAppearance.Provider>;
}

export function useGuideAppearance() {
  const appearance = useContext(GuideAppearance);
  if (!appearance) throw new Error('GuideThemeProvider is required');
  return appearance;
}

export function useGuideColors() {
  return useGuideAppearance().darkMode ? dark : light;
}
