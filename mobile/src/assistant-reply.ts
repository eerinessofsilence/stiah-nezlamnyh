export function replyPresentation(answerTop: number, visibleTop: number, visibleBottom: number, follow: boolean, reduced: boolean) {
  if (!follow || visibleBottom <= visibleTop) return 'show';
  if (answerTop < visibleTop || answerTop >= visibleBottom) return reduced ? 'jump' : 'scroll';
  return reduced ? 'show' : 'fade';
}
