import * as Network from 'expo-network';
import Storage from 'expo-sqlite/kv-store';
import { createContext, type ReactNode, useContext, useState } from 'react';
import { Alert } from 'react-native';

import { readProfile, type GuideProfile } from './guide-profile';

const profileKey = 'nezlamnyi-guide-profile-v1';
const legacyStatusKey = 'nezlamnyi-user-status-v1';
const assistantConsentKey = 'nezlamnyi-assistant-consent-v1';

function loadAssistantConsent() {
  try {
    const value = Storage.getItemSync(assistantConsentKey);
    return value === 'allowed' ? true : value === 'declined' ? false : null;
  } catch {
    return null;
  }
}

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
  assistantConsent: boolean | null;
  saveAssistantConsent: (allowed: boolean) => boolean;
} | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState(loadProfile);
  const [query, setQuery] = useState('');
  const [assistantConsent, setAssistantConsent] = useState(loadAssistantConsent);
  const network = Network.useNetworkState();

  function saveAssistantConsent(allowed: boolean) {
    if (!allowed) setAssistantConsent(false);
    try {
      Storage.setItemSync(assistantConsentKey, allowed ? 'allowed' : 'declined');
      if (allowed) setAssistantConsent(true);
      return true;
    } catch {
      Alert.alert(allowed ? 'Онлайн-допомогу не ввімкнено' : 'Онлайн-допомогу вимкнено в цьому сеансі',
        'Не вдалося зберегти налаштування. Спробуйте ще раз.');
      return false;
    }
  }

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
    assistantConsent, saveAssistantConsent,
    query, setQuery, offline: network.isConnected === false || network.isInternetReachable === false,
  }}>{children}</GuideState.Provider>;
}

export function useGuideState() {
  const state = useContext(GuideState);
  if (!state) throw new Error('GuideProvider is required');
  return state;
}
