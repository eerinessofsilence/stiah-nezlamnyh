import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';
import { createContext, type ReactNode, useContext, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { preparation, services } from './data/catalog';
import { readProgress, type RouteProgress, toggleProgress } from './route-progress';

const storageKey = 'nezlamnyi-route-progress-v1';
const serviceIds = new Set(services.map(({ id }) => id));
const itemIds = new Set(Object.entries(preparation).flatMap(([id, checklist]) => checklist?.items.map(([key]) => `${id}:${key}`) ?? []));

function loadProgress() {
  try {
    return readProgress(Storage.getItemSync(storageKey), serviceIds, itemIds);
  } catch {
    return null;
  }
}

const GuideState = createContext<{
  query: string;
  setQuery: (query: string) => void;
  offline: boolean;
  progress: RouteProgress | null;
  retryProgress: () => void;
  toggle: (key: keyof RouteProgress, id: string) => void;
} | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState(loadProgress);
  const current = useRef(progress);
  const network = Network.useNetworkState();

  function retryProgress() {
    const loaded = loadProgress();
    current.current = loaded;
    setProgress(loaded);
    if (!loaded) Alert.alert('Не вдалося відкрити збережене', 'Спробуйте ще раз пізніше.');
  }

  function toggle(key: keyof RouteProgress, id: string) {
    if (!current.current || !(key === 'saved' ? serviceIds : itemIds).has(id)) return;
    const next = toggleProgress(current.current, key, id);

    try {
      Storage.setItemSync(storageKey, JSON.stringify(next));
      current.current = next;
      setProgress(next);
    } catch {
      Alert.alert('Не вдалося зберегти зміну', 'Спробуйте ще раз. Попередній стан залишився збереженим.');
    }
  }

  return <GuideState.Provider value={{
    query, setQuery, offline: network.isConnected === false || network.isInternetReachable === false,
    progress, retryProgress, toggle,
  }}>{children}</GuideState.Provider>;
}

export function useGuideState() {
  const state = useContext(GuideState);
  if (!state) throw new Error('GuideProvider is required');
  return state;
}
