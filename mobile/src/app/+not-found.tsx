import { useRouter } from 'expo-router';

import { GuideButton, GuideScreen } from '../guide';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <GuideScreen title="Сторінку не знайдено">
      <GuideButton label="На головну" accessibilityRole="link" onPress={() => router.replace('/')} />
    </GuideScreen>
  );
}
