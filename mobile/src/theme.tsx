import Storage from 'expo-sqlite/kv-store';
import { createContext, type ReactNode, useContext, useLayoutEffect, useState } from 'react';
import { Alert, Appearance } from 'react-native';

const light = {
  background: '#f0f0e6',
  surface: '#fbfbf6',
  surfaceMuted: '#dfe3d2',
  surfaceSoft: '#e4e7d8',
  border: '#e2e3d8',
  borderStrong: '#7d836b',
  foreground: '#202319',
  foregroundMuted: '#59604f',
  accent: '#566143',
  button: '#a0aa8c',
  onAccent: '#20280f',
  primaryButton: '#20280f',
  primaryButtonPressed: '#343e20',
  onPrimaryButton: '#fbfbf6',
  feature: '#20280f',
  featurePressed: '#343e20',
  onFeature: '#fbfbf6',
  hero: '#142f30',
  onHero: '#e0e5d8',
  heroGradient: 'linear-gradient(to top, #142f30eb, #142f30ae 22%, #142f3038 45%, #142f3000 60%)',
};

const dark: typeof light = {
  background: '#1c2118',
  surface: '#282e22',
  surfaceMuted: '#3f4934',
  surfaceSoft: '#343e2d',
  border: '#46513d',
  borderStrong: '#8c9879',
  foreground: '#f0f2e8',
  foregroundMuted: '#bdc6b1',
  accent: '#c5d5b2',
  button: '#b9c6a3',
  onAccent: '#25331c',
  primaryButton: '#b9c6a3',
  primaryButtonPressed: '#d1dbbf',
  onPrimaryButton: '#25331c',
  feature: '#11180d',
  featurePressed: '#25331c',
  onFeature: '#f0f2e8',
  hero: '#142f30',
  onHero: '#e0e5d8',
  heroGradient: 'linear-gradient(to top, #142f30eb, #142f30ae 22%, #142f3038 45%, #142f3000 60%)',
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
