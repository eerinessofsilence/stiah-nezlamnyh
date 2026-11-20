import { Redirect } from 'expo-router';

import { useGuideState } from '../guide-state';
import { ProfileForm } from '../profile-form';

export default function ProfileScreen() {
  const { profile } = useGuideState();
  return profile ? <ProfileForm editing /> : <Redirect href="/welcome" />;
}
