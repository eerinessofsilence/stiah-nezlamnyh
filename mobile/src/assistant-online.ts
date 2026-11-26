import { Alert } from 'react-native';

const httpsEndpoint = /^https:\/\/[^/\\\s@?#]+\/api\/assistant$/;
const devUrl = __DEV__ ? process.env.EXPO_PUBLIC_ASSISTANT_URL : undefined;
export const devAssistantEndpoint = devUrl && (httpsEndpoint.test(devUrl) ||
  /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\/assistant$/.test(devUrl)) ? devUrl : undefined;
const storeUrl = process.env.EXPO_PUBLIC_STORE_ASSISTANT_URL;
export const storeAssistantEndpoint = !__DEV__ && storeUrl && httpsEndpoint.test(storeUrl) ? storeUrl : undefined;

export function askAssistantConsent(firstQuestion = false) {
  return new Promise<boolean>(resolve => {
    Alert.alert(
      'Дозволити онлайн-допомогу?',
      'Текст надісланого запитання й тема попередньої відповіді передаються через Cloudflare до OpenAI для пошуку в гіді. Не додавайте імен, номерів документів чи інших відомостей, за якими вас можна впізнати. Дозвіл можна відкликати в «Меню» → «Про гід».',
      [
        { text: 'Шукати на пристрої', style: 'cancel', onPress: () => resolve(false) },
        { text: firstQuestion ? 'Дозволити й надіслати' : 'Дозволити', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}
