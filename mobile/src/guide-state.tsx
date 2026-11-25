import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { Alert } from 'react-native';

import { readProfile, type GuideProfile } from './guide-profile';

const profileKey = 'nezlamnyi-guide-profile-v1';
const legacyStatusKey = 'nezlamnyi-user-status-v1';

function loadProfile() {
  try {
    return readProfile(Storage.getItemSync(profileKey), Storage.getItemSync(legacyStatusKey));
  } catch {
    return null;
  }
}

const GuideState = createContext<{
  profile: GuideProfile | null;
  saveProfile: (profile: GuideProfile) => boolean;
  query: string;
  setQuery: (query: string) => void;
  offline: boolean;
} | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(loadProfile);
  const [query, setQuery] = useState('');
  const network = Network.useNetworkState();

  function saveProfile(next: GuideProfile) {
    try {
      Storage.setItemSync(profileKey, JSON.stringify(next));
      setProfile(next);
      if (profile?.statusId !== next.statusId) setQuery('');
      return true;
    } catch {
      Alert.alert('Не вдалося зберегти профіль', 'Спробуйте ще раз.');
      return false;
    }
  }

  return <GuideState.Provider value={{
    profile, saveProfile,
    query, setQuery, offline: network.isConnected === false || network.isInternetReachable === false,
  }}>{children}</GuideState.Provider>;
}

export function useGuideState() {
  const state = useContext(GuideState);
  if (!state) throw new Error('GuideProvider is required');
  return state;
}
