import type { Service } from './data/catalog';

export function replyPresentation(answerTop: number, visibleTop: number, visibleBottom: number, follow: boolean, reduced: boolean) {
  if (!follow || visibleBottom <= visibleTop) return 'show';
  if (answerTop < visibleTop || answerTop >= visibleBottom) return reduced ? 'jump' : 'scroll';
  return reduced ? 'show' : 'fade';
}

export function assistantShortReply(question: string) {
  const phrase = question.toLocaleLowerCase('uk').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const check = phrase.replace(/^(?:(?:алло|ало)(?: |$))+/u, '');
  const ukrainian = /^(?:(?:ти|ви) мене чує(?:ш|те)|мене чути|чує(?:ш|те) мене)$/u;
  const russian = /^(?:(?:ты|вы) меня слыши(?:шь|те)|меня слышно|слыши(?:шь|те) меня)$/u;
  if ((phrase && !check) || ukrainian.test(check) || russian.test(check)) {
    return 'Так, я на зв’язку. Чим можу допомогти?';
  }
  if (/^(?:як (?:в тебе |у тебе |у вас )?справи|как (?:у тебя |у вас )?дела)(?: (?:вообще|взагалі))?$/u.test(check)) {
    return 'Я на зв’язку. Можу пояснити ветеранський термін або допомогти знайти послугу в гіді.';
  }
}

export function catalogOverview(service: Service) {
  const topics = service.sections.filter(section => !section.definition).slice(0, 3);
  return { intro: service.desc, topics };
}
