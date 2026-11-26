import type { Service } from './data/catalog';
import type { Conversation } from './search';

const alternateReplies: Record<Conversation, string[]> = {
  greeting: ['Добрий день! З чим вам допомогти?', 'Вітаю! Можете запитати про ветеранські послуги, документи чи підтримку.'],
  available: ['Так, я тут. Яке у вас запитання?', 'Я на зв’язку. Напишіть, що потрібно з’ясувати.'],
  thanks: ['Радий допомогти. Звертайтеся, якщо знадобиться ще щось.', 'На здоров’я! Можемо розібрати й наступне запитання.'],
  about: ['Можете описати свою ситуацію своїми словами. Я пошукаю потрібні кроки й контакти у ветеранському гіді.', 'Я допомагаю знайти у гіді документи, послуги та куди з ними звернутися.'],
  offTopic: ['Я допомагаю з ветеранськими питаннями. Можете запитати про документи, пільги чи доступну підтримку.', 'Опишіть, яку ветеранську послугу чи інформацію ви шукаєте, і я спробую допомогти.'],
};

export function nextConversationText(conversation: Conversation, initial: string, previous?: string) {
  const choices = [initial, ...alternateReplies[conversation]];
  return choices[(choices.findIndex(text => text === previous) + 1) % choices.length];
}

export function replyPresentation(answerTop: number, answerHeight: number, visibleTop: number, visibleBottom: number, follow: boolean, reduced: boolean) {
  if (!follow || visibleBottom <= visibleTop) return 'show';
  if (answerTop < visibleTop || answerTop + answerHeight > visibleBottom) return reduced ? 'jump' : 'scroll';
  return reduced ? 'show' : 'fade';
}

export function localConversation(question: string): Conversation | undefined {
  const phrase = question.toLocaleLowerCase('uk').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const greeting = /^(?:привіт|привет|вітаю|доброго ранку|добрий (?:день|вечір)|доброго дня|доброе утро|добрый (?:день|вечер)|здравствуй(?:те)?)(?: |$)/u;
  const afterGreeting = phrase.replace(greeting, '');
  if (phrase && !afterGreeting) {
    return 'greeting';
  }
  const check = afterGreeting.replace(/^(?:(?:алло|ало)(?: |$))+/u, '');
  const ukrainian = /^(?:(?:ти|ви) мене чує(?:ш|те)|мене чути|чує(?:ш|те) мене)$/u;
  const russian = /^(?:(?:ты|вы) меня слыши(?:шь|те)|меня слышно|слыши(?:шь|те) меня)$/u;
  if ((phrase && !check) || ukrainian.test(check) || russian.test(check)) {
    return 'available';
  }
  if (/^(?:як (?:в тебе |у тебе |у вас )?справи|как (?:у тебя |у вас )?дела)(?: (?:вообще|взагалі))?$/u.test(check)) {
    return 'about';
  }
}

export function catalogOverview(service: Service) {
  const topics = service.sections.filter(section => !section.definition).slice(0, 3);
  return { intro: service.desc, topics };
}
