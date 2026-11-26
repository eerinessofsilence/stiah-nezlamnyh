import { Alert, Platform } from 'react-native';

const httpsEndpoint = /^https:\/\/[^/\\\s@?#]+\/api\/assistant$/;
const devUrl = __DEV__ ? process.env.EXPO_PUBLIC_ASSISTANT_URL : undefined;
export const devAssistantEndpoint = devUrl && (httpsEndpoint.test(devUrl) ||
  /^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\/assistant$/.test(devUrl)) ? devUrl : undefined;
const storeUrl = process.env.EXPO_PUBLIC_STORE_ASSISTANT_URL;
export const storeAssistantEndpoint = !__DEV__ && storeUrl && httpsEndpoint.test(storeUrl) ? storeUrl : undefined;
export const storeVoiceEndpoint = Platform.OS === 'ios' ? storeAssistantEndpoint : undefined;

export function askVoiceConsent() {
  return new Promise<boolean>(resolve => {
    Alert.alert(
      'Дозволити голосову допомогу?',
      'Під час запису та розмови аудіо передається через Cloudflare до OpenAI для розпізнавання. Під час розмови розпізнане запитання й тема попередньої відповіді також передаються, щоб знайти відповідь у гіді або відповісти на загальне питання. Не називайте імен, номерів документів чи інших особистих відомостей. Дозвіл можна відкликати в «Меню» → «Про гід».',
      [
        { text: 'Скасувати', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Дозволити', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

export function askAssistantConsent(firstQuestion = false) {
  return new Promise<boolean>(resolve => {
    Alert.alert(
      'Дозволити онлайн-допомогу?',
      'Текст надісланого запитання й тема попередньої відповіді передаються через Cloudflare до OpenAI, щоб знайти відповідь у гіді або відповісти на загальне питання. Не додавайте імен, номерів документів чи інших відомостей, за якими вас можна впізнати. Дозвіл можна відкликати в «Меню» → «Про гід».',
      [
        { text: 'Шукати на пристрої', style: 'cancel', onPress: () => resolve(false) },
        { text: firstQuestion ? 'Дозволити й надіслати' : 'Дозволити', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}
