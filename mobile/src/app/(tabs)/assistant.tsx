import { useIsFocused } from 'expo-router/react-navigation';
import { Fragment, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, ScrollView, type HostInstance, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-screens/experimental';

import { checkedOn, preparation, revision, services, sources } from '../../data/catalog';
import { hotline, localContacts } from '../../data/contacts';
import { ExternalLink, GuideButton, guideContentInset, guideContentMaxWidth, GuideIcon, GuidePanel, GuidePressable, GuideScreen, GuideText, hasNativeHomeTabs, icons, RouteLink } from '../../guide';
import { useGuideState } from '../../guide-state';
import { RouteAction, RouteSources } from '../../route-actions';
import { type AnswerChoice, answerSections, findContacts, localAnswers, parseAiAnswers } from '../../search';
import { GuideInputFrame, GuideTextInput, GuideSheet, GuideSwitch } from '../../form-controls';
import { useGuideColors } from '../../theme';
import { useAssistantAudio } from '../../assistant-audio';
import { replyPresentation } from '../../assistant-reply';
import { motion, useReducedMotion } from '../../guide-motion';

const prompts = [
  'Які документи потрібні для УБД?',
  'Чи потрібна інвалідність для протеза?',
  'Яка знижка на комунальні послуги?',
  'Що робити після поранення?',
];
const composerRadius = 18;
// Store builds only search the bundled catalogue, including when an endpoint is configured locally.
const endpoint = __DEV__ ? process.env.EXPO_PUBLIC_ASSISTANT_URL : undefined;
const onlineEndpoint = endpoint && /^(?:https:\/\/[^/@?#]+|http:\/\/(?:localhost|127\.0\.0\.1):\d+)\/api\/assistant$/.test(endpoint) ? endpoint : undefined;
const remote = onlineEndpoint?.startsWith('https://');
const noAnswer = 'У гіді немає підтвердженої відповіді на це запитання. Уточніть, про яку послугу йдеться, або зверніться на обласну ветеранську лінію.';
const chooseTopic = 'Що саме вас цікавить?';
const clarifyTopic = 'Уточніть, яка саме процедура або умова вас цікавить.';
const voiceStatus = {
  idle: '', permission: 'Доступ до мікрофона', recording: 'Записую…', transcribing: 'Розпізнаю…',
  connecting: 'Підключаюся…', listening: 'Слухаю', confirming: 'Перевірте розпізнаний текст', thinking: 'Шукаю відповідь…',
  speaking: 'Відповідаю', muted: 'Мікрофон вимкнено',
};

type Turn = { id: number; question: string; answers?: AnswerChoice[]; fallback?: string };

function describeAnswer(question: string, answers: AnswerChoice[]) {
  if (answers.length > 1) return { text: chooseTopic };
  const choice = answers[0];
  const service = services.find(item => item.id === choice?.route);
  if (!service) return { text: noAnswer };
  const section = service.sections.find(item => item.id === choice.section);
  const local = service.id === 'escort' && findContacts(localContacts, question)[0] || undefined;
  const paragraphs = local ? [local.description, local.details].filter((part): part is string => Boolean(part)) :
    section?.paragraphs ?? [service.steps[0], clarifyTopic];
  return { service, section, local, paragraphs, text: paragraphs.join(' ') };
}

export default function AssistantScreen() {
  const colors = useGuideColors();
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const screenFocused = useRef(focused);
  const ios = Platform.OS === 'ios';
  const { top, bottom } = useSafeAreaInsets();
  const { offline } = useGuideState();
  const [online, setOnline] = useState(false);
  const [voiceReady, setVoiceReady] = useState<boolean>();
  const [token, setToken] = useState('');
  const [tokenFocused, setTokenFocused] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const previous = useRef<AnswerChoice | null>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const nextId = useRef(0);
  const revealTurn = useRef<number | null>(null);
  const replyScroll = useRef<number | null>(null);
  const viewport = useRef({ offset: hasNativeHomeTabs ? -top : 0, height: 0, inset: hasNativeHomeTabs ? top : 0 });
  const scroll = useRef<ScrollViewInstance>(null);
  const liveTrigger = useRef<HostInstance>(null);
  const voiceEnabled = Boolean(online && voiceReady && onlineEndpoint && !offline);
  const audio = useAssistantAudio({
    endpoint: onlineEndpoint, token: token.trim(), active: voiceEnabled && focused,
    onDraft: text => { setQuestion(text); setVoiceDraft(true); },
    onQuestion: text => submit(text, true),
  });
  const { liveOpen } = audio;

  useEffect(() => {
    setVoiceReady(undefined);
    if (!online || !onlineEndpoint || offline) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 6000);
    const headers: Record<string, string> = token.trim() ? { Authorization: 'Bearer ' + token.trim() } : {};
    void fetch(onlineEndpoint, { headers, signal: controller.signal })
      .then(async response => {
        if (!response.ok) return false;
        const status = await response.json();
        return status.voice === true && status.revision === revision;
      })
      .then(available => { if (!controller.signal.aborted) setVoiceReady(available); })
      .catch(() => { if (!controller.signal.aborted || controller.signal.reason === 'timeout') setVoiceReady(false); })
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [online, offline, token]);

  useEffect(() => {
    screenFocused.current = focused;
    if (!focused) {
      revealTurn.current = null;
      replyScroll.current = null;
    }
  }, [focused]);

  useLayoutEffect(() => {
    if (!reduced || replyScroll.current === null) return;
    scroll.current?.scrollTo({ y: replyScroll.current, animated: false });
    replyScroll.current = null;
  }, [reduced]);

  useEffect(() => {
    if (!focused || !ios) return;
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
      setKeyboardOpen(false);
    };
  }, [focused, ios]);

  async function submit(text: string, fromLive = false) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500 || pending.current) return;

    pending.current = true;
    const id = nextId.current++;
    revealTurn.current = fromLive ? null : id;
    setTurns(history => [...history, { id, question: trimmed }]);
    if (!fromLive) {
      setQuestion('');
      setVoiceDraft(false);
      Keyboard.dismiss();
    }
    const context = previous.current;
    let answers: AnswerChoice[];
    let fallback: string | undefined;
    if (online && onlineEndpoint && !offline) {
      setLoading(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 11000);
      try {
        const response = await fetch(onlineEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token.trim() && { Authorization: 'Bearer ' + token.trim() }),
          },
          body: JSON.stringify({ question: trimmed, previous: context, revision }),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 409) fallback = 'Версії гіда різняться. Показую результат пошуку на пристрої.';
          if (response.status === 403) fallback = 'Перевірте код доступу. Показую результат пошуку на пристрої.';
          throw new Error();
        }
        answers = parseAiAnswers(services, (await response.json()).answers);
      } catch {
        fallback ??= 'Онлайн-помічник недоступний. Показую результат пошуку на пристрої.';
        answers = localAnswers(services, trimmed, context);
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    } else {
      answers = localAnswers(services, trimmed, context);
    }
    pending.current = false;
    previous.current = answers.length === 1 ? answers[0] : null;
    setTurns(history => history.map(turn => turn.id === id ? { ...turn, answers, fallback } : turn));
    if (!fromLive && screenFocused.current) AccessibilityInfo.announceForAccessibility(answers.length > 1 ? 'Уточніть запит' : answers.length ? 'Відповідь готова' : 'Відповіді не знайдено');
    return fallback ?? describeAnswer(trimmed, answers).text;
  }

  function clarify(id: number, choice: AnswerChoice) {
    const turn = turns.find(item => item.id === id);
    if (!turn?.answers) return;
    const service = services.find(item => item.id === choice.route);
    const matches = !choice.section && service ? answerSections(service, turn.question) : [];
    const answers = matches.length ? matches.map(({ id }) => ({ route: choice.route, section: id })) : [choice];
    if (id === turns.at(-1)?.id) previous.current = answers.length === 1 ? answers[0] : null;
    setTurns(history => history.map(item => item.id === id ? { ...item, answers } : item));
    AccessibilityInfo.announceForAccessibility('Запит уточнено');
  }

  function revealReply(id: number, y: number) {
    const follow = revealTurn.current === id && focused && !liveOpen;
    if (revealTurn.current === id) revealTurn.current = null;
    const { offset, height, inset } = viewport.current;
    const safeBottom = hasNativeHomeTabs && !keyboardOpen ? bottom : 0;
    const presentation = replyPresentation(y, offset + inset, offset + height - (ios ? footerHeight + safeBottom : 0), follow, reduced);
    if (presentation === 'scroll' || presentation === 'jump') {
      const target = Math.max(-inset, y - inset - 12);
      replyScroll.current = presentation === 'scroll' ? target : null;
      scroll.current?.scrollTo({ y: target, animated: presentation === 'scroll' });
    }
    return presentation === 'fade';
  }

  const busyAudio = audio.phase !== 'idle';
  const canSend = !loading && !busyAudio && question.trim().length > 0 && question.trim().length <= 500;
  const inputLimit = voiceDraft ? Math.max(500, question.length) : 500;
  const composer = (
    <View style={[styles.composer, { backgroundColor: colors.background }]}>
      {!!audio.error && !liveOpen && <GuideText type="support" announcement>{audio.error}</GuideText>}
      {voiceDraft && <GuideText type="support" announcement>{question.trim().length > 500
        ? 'Скоротіть запитання до 500 символів.' : 'Перевірте розпізнаний текст перед надсиланням.'}</GuideText>}
      {voiceEnabled && !busyAudio && <View style={styles.voiceActions}>
        <GuideButton label="Записати повідомлення" disabled={loading || Boolean(question.trim())} onPress={() => {
          Keyboard.dismiss();
          void audio.startRecording();
        }} />
        <GuideButton label="Почати розмову" ref={liveTrigger} disabled={loading || Boolean(question.trim())} onPress={() => {
          Keyboard.dismiss();
          void audio.startLive();
        }} />
      </View>}
      {!liveOpen && audio.phase === 'recording' && <GuidePanel>
        <GuideText type="support">Записую… {audio.seconds} с</GuideText>
        <View style={styles.voiceActions}>
          <GuideButton label="Скасувати" onPress={audio.cancel} />
          <GuideButton label="Зупинити запис" variant="primary" onPress={() => void audio.finishRecording(true)} />
        </View>
      </GuidePanel>}
      {!liveOpen && audio.phase === 'transcribing' && <GuideText type="support" announcement>Розпізнаю запис…</GuideText>}
      <GuideInputFrame focused={composerFocused} radius={composerRadius} style={styles.composerRow}>
        <GuideTextInput
          accessibilityLabel="Запитання Характернику"
          placeholder="Напишіть запитання"
          compactPlaceholder="Запит"
          value={question}
          onChangeText={setQuestion}
          onFocus={() => setComposerFocused(true)}
          onBlur={() => setComposerFocused(false)}
          autoComplete="off"
          returnKeyType="send"
          onSubmitEditing={({ nativeEvent }) => { if (canSend) void submit(nativeEvent.text); }}
          editable={!busyAudio}
          maxLength={inputLimit}
        />
        <GuidePressable accessibilityRole="button" accessibilityLabel="Надіслати запитання"
          focusColor={colors.onFeature} pressedColor={colors.featurePressed}
          accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={() => submit(question)}
          style={[styles.send, { backgroundColor: canSend ? colors.feature : colors.surfaceMuted }]}>
          <GuideIcon name="paper-plane-right-fill" color={canSend ? colors.onFeature : colors.foregroundMuted} size={20} />
        </GuidePressable>
      </GuideInputFrame>
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={ios ? 'padding' : undefined}>
      <GuideScreen scrollRef={scroll} footerHeight={ios ? footerHeight : 0}
        onLayout={({ nativeEvent }) => { viewport.current.height = nativeEvent.layout.height; }}
        onScroll={({ nativeEvent }) => {
          const offset = nativeEvent.contentOffset.y;
          const inset = Math.max(nativeEvent.contentInset.top, hasNativeHomeTabs ? top : 0);
          viewport.current = { offset, height: nativeEvent.layoutMeasurement.height, inset };
          if (replyScroll.current !== null && Math.abs(replyScroll.current - offset) <= 1) replyScroll.current = null;
        }}
        onScrollBeginDrag={() => {
          revealTurn.current = null;
          replyScroll.current = null;
        }}
        onMomentumScrollEnd={() => { replyScroll.current = null; }}>
        {turns.length === 0 ? <ImageBackground
          source={require('../../../assets/coast.webp')}
          style={[styles.intro, { backgroundColor: colors.hero }]}
          imageStyle={styles.illustration}
        >
          <View pointerEvents="none" style={[styles.shade, { experimental_backgroundImage: colors.heroGradient }]} />
          <GuideText type="title" tone="onHero">Характерник</GuideText>
          <GuideText type="support" tone="onHero">Запитайте про документи, пільги, лікування або допомогу на Одещині.</GuideText>
        </ImageBackground> : <GuideText type="title">Характерник</GuideText>}
        {onlineEndpoint && <GuidePanel>
          <View style={styles.mode}>
            <GuideText type="support" style={styles.modeText}>Онлайн-помічник</GuideText>
            <GuideSwitch accessibilityLabel="Онлайн-помічник" value={online} onValueChange={setOnline} disabled={loading || busyAudio || Boolean(remote && !token.trim())} />
          </View>
          {!online && <GuideText type="meta" tone="foregroundMuted">Онлайн-режим надсилає запитання й тему розмови на сервер гіда та OpenAI. Якщо ввімкнете голос, туди також піде аудіо для розпізнавання. Не вказуйте номери документів, імена й медичні дані.</GuideText>}
          {online && voiceReady === false && <GuideText type="meta" tone="foregroundMuted">Голосовий режим зараз недоступний.</GuideText>}
          {remote && !online && <GuideInputFrame focused={tokenFocused}>
            <GuideTextInput value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false}
              onFocus={() => setTokenFocused(true)} onBlur={() => setTokenFocused(false)}
              accessibilityLabel="Код доступу до Dev" placeholder="Код доступу до Dev" compactPlaceholder="Код Dev" />
          </GuideInputFrame>}
        </GuidePanel>}
        {turns.length === 0 && <View style={styles.prompts}>
          {prompts.map(label => (
            <GuideButton key={label} label={label} row icon={icons.arrow} disabled={loading || busyAudio} onPress={() => void submit(label)} />
          ))}
        </View>}
        {turns.map((turn) => (
          <Fragment key={turn.id}>
            <View style={[styles.question, { backgroundColor: colors.feature }]}>
              <GuideText type="support" tone="onFeature">{turn.question}</GuideText>
            </View>
            {turn.answers ? <ReplyAppearance pending={revealTurn.current === turn.id} onReveal={y => revealReply(turn.id, y)}>
              <AssistantAnswer turn={turn} answers={turn.answers} onChoose={choice => clarify(turn.id, choice)}
                onSpeak={audio.voice ? audio.speak : undefined} />
            </ReplyAppearance> : <GuideText type="support" announcement>Шукаю відповідь…</GuideText>}
          </Fragment>
        ))}
      </GuideScreen>
      <SafeAreaView edges={ios ? { bottom: !keyboardOpen, left: true, right: true } : {}}
        pointerEvents="box-none" style={ios && styles.docked}>
        <View pointerEvents="box-none" style={styles.footer}
          onLayout={ios ? ({ nativeEvent }) => setFooterHeight(nativeEvent.layout.height) : undefined}>
          {composer}
        </View>
      </SafeAreaView>
      {onlineEndpoint && <GuideSheet title="Голосова розмова" open={liveOpen} trigger={liveTrigger} doneLabel="Завершити розмову"
        onClose={audio.cancel}>
        <GuideText announcement>{voiceStatus[audio.phase]}</GuideText>
        {!!audio.error && <GuideText type="support" announcement>{audio.error}</GuideText>}
        {audio.phase === 'confirming' ? <GuidePanel>
          <ScrollView style={styles.transcript}><GuideText>{audio.confirmation}</GuideText></ScrollView>
          <GuideButton label="Підтвердити" variant="primary" onPress={() => audio.confirmTranscript(false)} />
          <GuideButton label="Виправити в чаті" onPress={() => audio.confirmTranscript(true)} />
        </GuidePanel> : <>
        <GuideButton label={audio.phase === 'muted' ? 'Увімкнути мікрофон' : 'Вимкнути мікрофон'}
          disabled={audio.phase === 'connecting' || audio.phase === 'permission'} onPress={() => void audio.toggleMic()} />
        {audio.phase === 'speaking' ? <GuideButton label="Перервати відповідь" onPress={audio.stopSpeech} /> :
          <GuideButton label="Я закінчив" disabled={audio.phase !== 'listening'} onPress={audio.commit} />}
        </>}
      </GuideSheet>}
    </KeyboardAvoidingView>
  );
}

function ReplyAppearance({ pending, onReveal, children }: { pending: boolean; onReveal: (y: number) => boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const reveal = useRef(pending);
  const [opacity] = useState(() => new Animated.Value(pending && !reduced ? 0 : 1));
  useEffect(() => {
    if (reduced) opacity.setValue(1);
    return () => opacity.stopAnimation();
  }, [opacity, reduced]);

  return <Animated.View style={{ opacity }} onLayout={({ nativeEvent }) => {
    if (!reveal.current) return;
    reveal.current = false;
    if (onReveal(nativeEvent.layout.y)) {
      Animated.timing(opacity, {
        toValue: 1, duration: motion.appear, easing: motion.easeOut, useNativeDriver: true, isInteraction: false,
      }).start();
    } else {
      opacity.setValue(1);
    }
  }}>{children}</Animated.View>;
}

function AssistantAnswer({ turn, answers, onChoose, onSpeak }: {
  turn: Turn; answers: AnswerChoice[]; onChoose: (choice: AnswerChoice) => void; onSpeak?: (text: string) => void;
}) {
  const { service, section, local, paragraphs, text } = describeAnswer(turn.question, answers);
  const checklist = service && preparation[service.id];
  const actionKey = section?.action?.[0];
  const sourceKeys = local ? [local.source] : section?.source ?? (service && [...new Set([
    ...(actionKey && sources[actionKey] ? [actionKey] : []),
    ...(checklist?.section === section?.id && checklist?.source ? [checklist.source] : []),
    ...service.source,
  ])]) ?? [];
  return <GuidePanel>
    {turn.fallback && <GuideText type="meta" tone="foregroundMuted">{turn.fallback} Знімок гіда від {checkedOn}.</GuideText>}
    {answers.length > 1 ? <>
      <GuideText type="section">{chooseTopic}</GuideText>
      {answers.map(choice => {
        const topic = services.find(item => item.id === choice.route);
        const part = topic?.sections.find(item => item.id === choice.section);
        return topic && <GuideButton key={choice.route + choice.section} label={part?.title ?? topic.title}
          row icon={icons.arrow} onPress={() => onChoose(choice)} />;
      })}
    </> : !service ? <>
      <GuideText type="support">{noAnswer}</GuideText>
      <ExternalLink url={hotline.dial} label={hotline.phone} variant="primary" icon={icons.phone} />
    </> : <>
      <GuideText type={local ? 'section' : 'sheetTitle'}>{local ? local.title : section?.title ?? service.title}</GuideText>
      {paragraphs?.map(paragraph => <GuideText key={paragraph}>{paragraph}</GuideText>)}
      {local && <ExternalLink url={local.dial} label={local.phone} icon={icons.phone} fullWidth />}
      {!section && !local && service.sections.map(item => <GuideButton key={item.id} label={item.title}
        row icon={icons.arrow} onPress={() => onChoose({ route: service.id, section: item.id })} />)}
      <RouteAction action={section?.action ?? service.action} />
      <RouteLink id={service.id} section={section?.id} />
      {onSpeak && <GuideButton label="Прослухати" row onPress={() => onSpeak(text)} />}
      <RouteSources key={service.id + (section?.id ?? '')} sourceKeys={sourceKeys} />
    </>}
  </GuidePanel>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { borderRadius: 18, overflow: 'hidden', paddingHorizontal: 16, paddingBottom: 24, paddingTop: 84, gap: 8 },
  illustration: { borderRadius: 18 },
  shade: { ...StyleSheet.absoluteFill },
  prompts: { gap: 8 },
  question: { alignSelf: 'flex-end', borderRadius: 16, maxWidth: '90%', padding: 12 },
  docked: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footer: { paddingHorizontal: guideContentInset },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeText: { flex: 1 },
  composer: { width: '100%', maxWidth: guideContentMaxWidth - 2 * guideContentInset, alignSelf: 'center', marginBottom: 12, gap: 8, borderRadius: composerRadius },
  transcript: { maxHeight: 160 },
  voiceActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composerRow: { gap: 8, paddingVertical: 4, paddingLeft: 12, paddingRight: 4 },
  send: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
