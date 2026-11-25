import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { Fragment, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Keyboard, KeyboardAvoidingView, Platform, type HostInstance, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-screens/experimental';

import { checkedOn, preparation, revision, services, sources } from '../../data/catalog';
import { hotline, localContacts } from '../../data/contacts';
import { ExternalLink, GuideButton, guideContentInset, guideContentMaxWidth, GuideIcon, GuideIconButton, GuidePanel, GuidePressable, GuideScreen, GuideText, hasNativeHomeTabs, icons, RouteLink } from '../../guide';
import { useGuideState } from '../../guide-state';
import { RouteAction, RouteSources } from '../../route-actions';
import { type AnswerChoice, answerSections, findContacts, localAnswers, parseAiAnswers } from '../../search';
import { GuideInputFrame, GuideTextInput } from '../../form-controls';
import { useGuideColors } from '../../theme';
import { useAssistantAudio } from '../../assistant-audio';
import { AssistantRecordingBar } from '../../assistant-recording-bar';
import { useSetAssistantVoiceSession } from '../../assistant-voice-session';
import { useAssistantChats } from '../../assistant-chat-state';
import type { Turn } from '../../assistant-chats';
import { replyPresentation } from '../../assistant-reply';
import { focusGuideControl, motion, useReducedMotion } from '../../guide-motion';

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
  const router = useRouter();
  const { activeId, chats, getChat, getActiveId, updateChat } = useAssistantChats();
  const { turns, question, voiceDraft } = chats.find(chat => chat.id === activeId)!;
  const loading = turns.at(-1)?.answers === undefined && turns.length > 0;
  const colors = useGuideColors();
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const screenFocused = useRef(focused);
  const ios = Platform.OS === 'ios';
  const { bottom } = useSafeAreaInsets();
  const { offline } = useGuideState();
  const [voiceReady, setVoiceReady] = useState<boolean>();
  const [token, setToken] = useState('');
  const [tokenFocused, setTokenFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [composerFocused, setComposerFocused] = useState(false);
  const revealTurn = useRef<number | null>(null);
  const replyScroll = useRef<number | null>(null);
  const viewport = useRef({ offset: 0, height: 0, inset: 0 });
  const scroll = useRef<ScrollViewInstance>(null);
  const composerAction = useRef<HostInstance>(null);
  const historyTrigger = useRef<HostInstance>(null);
  const returnFromHistory = useRef(false);
  const returnFromVoice = useRef(false);
  const setVoiceSession = useSetAssistantVoiceSession();
  const devToken = token.trim();
  const online = Boolean(onlineEndpoint && (!remote || devToken) && !offline);
  const voiceEnabled = online && voiceReady === true;
  const audio = useAssistantAudio({
    endpoint: onlineEndpoint, token: devToken, active: voiceEnabled && focused,
    onDraft: text => updateChat(activeId, chat => ({ ...chat, question: text, voiceDraft: true })),
    onQuestion: text => submit(text, true),
  });

  useEffect(() => {
    setVoiceReady(undefined);
    if (!online || !onlineEndpoint) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 6000);
    const headers: Record<string, string> = devToken ? { Authorization: 'Bearer ' + devToken } : {};
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
  }, [online, devToken]);

  useEffect(() => {
    screenFocused.current = focused;
    if (!focused) {
      revealTurn.current = null;
      replyScroll.current = null;
    }
  }, [focused]);

  useLayoutEffect(() => {
    revealTurn.current = null;
    replyScroll.current = null;
    scroll.current?.scrollTo({ y: -viewport.current.inset, animated: false });
  }, [activeId]);

  useEffect(() => {
    if (!focused || (!returnFromHistory.current && !returnFromVoice.current)) return;
    const frame = requestAnimationFrame(() => {
      focusGuideControl(returnFromVoice.current ? composerAction.current : historyTrigger.current);
      returnFromHistory.current = false;
      returnFromVoice.current = false;
    });
    return () => cancelAnimationFrame(frame);
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
    const chat = getChat(activeId);
    const previous = chat?.turns.at(-1);
    if (!chat || !trimmed || trimmed.length > 500 || (previous && !previous.answers)) return;

    const id = (previous?.id ?? -1) + 1;
    revealTurn.current = fromLive ? null : id;
    updateChat(activeId, current => ({
      ...current, turns: [...current.turns, { id, question: trimmed }],
      ...(!fromLive && { question: '', voiceDraft: false }),
    }));
    if (!fromLive) Keyboard.dismiss();
    const context = previous?.answers?.length === 1 ? previous.answers[0] : null;
    let answers: AnswerChoice[];
    let fallback: string | undefined;
    if (online && onlineEndpoint) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 11000);
      try {
        const response = await fetch(onlineEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(devToken && { Authorization: 'Bearer ' + devToken }),
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
      }
    } else {
      answers = localAnswers(services, trimmed, context);
    }
    updateChat(activeId, current => ({
      ...current, turns: current.turns.map(turn => turn.id === id ? { ...turn, answers, fallback } : turn),
    }));
    if (!fromLive && screenFocused.current && getActiveId() === activeId) AccessibilityInfo.announceForAccessibility(answers.length > 1 ? 'Уточніть запит' : answers.length ? 'Відповідь готова' : 'Відповіді не знайдено');
    return fallback ?? describeAnswer(trimmed, answers).text;
  }

  function clarify(id: number, choice: AnswerChoice) {
    const turn = turns.find(item => item.id === id);
    if (!turn?.answers) return;
    const service = services.find(item => item.id === choice.route);
    const matches = !choice.section && service ? answerSections(service, turn.question) : [];
    const answers = matches.length ? matches.map(({ id }) => ({ route: choice.route, section: id })) : [choice];
    updateChat(activeId, current => ({ ...current, turns: current.turns.map(item => item.id === id ? { ...item, answers } : item) }));
    AccessibilityInfo.announceForAccessibility('Запит уточнено');
  }

  function revealReply(id: number, y: number) {
    const follow = revealTurn.current === id && focused;
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
  const questionLength = question.trim().length;
  const composerReady = !loading && !busyAudio;
  const canSend = composerReady && questionLength > 0 && questionLength <= 500;
  const showLiveAction = voiceEnabled && questionLength === 0;
  const canStartVoice = composerReady && questionLength === 0;
  const actionEnabled = showLiveAction ? canStartVoice : canSend;
  const inputLimit = voiceDraft ? Math.max(500, question.length) : 500;
  function openVoice() {
    if (!onlineEndpoint) return;
    if (!audio.voice) {
      Alert.alert('Потрібен український голос', 'Додайте український голос у налаштуваннях пристрою.');
      return;
    }
    Keyboard.dismiss();
    setVoiceSession({ endpoint: onlineEndpoint, token: devToken, voice: audio.voice,
      onDraft: text => updateChat(activeId, chat => ({ ...chat, question: text, voiceDraft: true })),
      onQuestion: text => submit(text, true),
    });
    returnFromVoice.current = true;
    router.push('/assistant-voice');
  }
  const title = (
    <View style={styles.titleRow}>
      <GuideText type="title" style={styles.titleText}>Характерник</GuideText>
      <GuideIconButton ref={historyTrigger} icon="chats" label="Історія чатів" disabled={busyAudio} onPress={() => {
        Keyboard.dismiss();
        returnFromHistory.current = true;
        router.push('/assistant-chats');
      }} />
    </View>
  );
  const composer = (
    <View style={[styles.composer, { backgroundColor: colors.background }]}>
      {!!audio.error && <GuideText type="support" announcement>{audio.error}</GuideText>}
      {voiceDraft && <GuideText type="support" announcement>{questionLength > 500
        ? 'Скоротіть запитання до 500 символів.' : 'Перевірте розпізнаний текст перед надсиланням.'}</GuideText>}
      {audio.phase === 'recording' || audio.phase === 'stopping' || audio.phase === 'recorded' || audio.phase === 'transcribing' ? (
        <AssistantRecordingBar recorder={audio.recorder} phase={audio.phase} onCancel={audio.cancel}
          onStop={() => void audio.finishRecording('keep')} onTranscribe={() => void audio.finishRecording('transcribe')} />
      ) : <GuideInputFrame focused={composerFocused} radius={composerRadius} style={styles.composerRow}>
        <GuideTextInput
          accessibilityLabel="Запитання Характернику"
          placeholder="Напишіть запитання"
          compactPlaceholder="Запит"
          value={question}
          onChangeText={text => updateChat(activeId, chat => ({ ...chat, question: text, voiceDraft: chat.voiceDraft && Boolean(text) }))}
          onFocus={() => setComposerFocused(true)}
          onBlur={() => setComposerFocused(false)}
          autoComplete="off"
          returnKeyType="send"
          onSubmitEditing={({ nativeEvent }) => { if (canSend) void submit(nativeEvent.text); }}
          editable={!busyAudio}
          maxLength={inputLimit}
        />
        {voiceEnabled && <GuidePressable accessibilityRole="button" accessibilityLabel="Записати повідомлення"
          accessibilityState={{ disabled: !canStartVoice }} disabled={!canStartVoice}
          onPress={() => { Keyboard.dismiss(); void audio.startRecording(); }}
          style={[styles.composerAction, { backgroundColor: canStartVoice ? colors.surfaceSoft : colors.surface }]}>
          <GuideIcon name="microphone" color={canStartVoice ? colors.foreground : colors.foregroundMuted} size={20} />
        </GuidePressable>}
        <GuidePressable ref={composerAction} accessibilityRole="button"
          accessibilityLabel={showLiveAction ? 'Почати розмову' : 'Надіслати запитання'}
          focusColor={colors.onFeature} pressedColor={colors.featurePressed}
          accessibilityState={{ disabled: !actionEnabled }} disabled={!actionEnabled} onPress={() => {
            if (showLiveAction) {
              openVoice();
            } else {
              void submit(question);
            }
          }}
          style={[styles.composerAction, { backgroundColor: actionEnabled ? colors.feature : colors.surfaceMuted }]}>
          <GuideIcon name={showLiveAction ? 'waveform' : 'paper-plane-right-fill'}
            color={actionEnabled ? colors.onFeature : colors.foregroundMuted} size={20} />
        </GuidePressable>
      </GuideInputFrame>}
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={ios ? 'padding' : undefined}>
      <GuideScreen fixedHeader={title} scrollRef={scroll} footerHeight={ios ? footerHeight : 0}
        onLayout={({ nativeEvent }) => { viewport.current.height = nativeEvent.layout.height; }}
        onScroll={({ nativeEvent }) => {
          const offset = nativeEvent.contentOffset.y;
          const inset = nativeEvent.contentInset.top;
          viewport.current = { offset, height: nativeEvent.layoutMeasurement.height, inset };
          if (replyScroll.current !== null && Math.abs(replyScroll.current - offset) <= 1) replyScroll.current = null;
        }}
        onScrollBeginDrag={() => {
          revealTurn.current = null;
          replyScroll.current = null;
        }}
        onMomentumScrollEnd={() => { replyScroll.current = null; }}>
        {remote && <GuideInputFrame focused={tokenFocused}>
          <GuideTextInput value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false}
            editable={!loading && !busyAudio} onFocus={() => setTokenFocused(true)} onBlur={() => setTokenFocused(false)}
            accessibilityLabel="Код доступу до Dev" placeholder="Код доступу до Dev" compactPlaceholder="Код Dev" />
        </GuideInputFrame>}
        {online && voiceReady === false && <GuideText type="meta" tone="foregroundMuted">Голосовий режим зараз недоступний.</GuideText>}
        {turns.length === 0 && <View style={styles.prompts}>
          {prompts.map(label => (
            <GuideButton key={label} label={label} row icon={icons.arrow} disabled={loading || busyAudio} onPress={() => void submit(label)} />
          ))}
        </View>}
        {turns.map((turn) => (
          <Fragment key={`${activeId}:${turn.id}`}>
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
      <GuideText type="section" style={styles.answerSection}>{chooseTopic}</GuideText>
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
      <GuideText type={local ? 'section' : 'sheetTitle'} style={local ? styles.answerSection : styles.answerTitle}>
        {local ? local.title : section?.title ?? service.title}
      </GuideText>
      {paragraphs?.map(paragraph => <GuideText key={paragraph} style={styles.answerParagraph}>{paragraph}</GuideText>)}
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
  titleRow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8,
    width: '100%', maxWidth: guideContentMaxWidth, paddingTop: 12, paddingHorizontal: guideContentInset,
  },
  titleText: { flex: 1 },
  prompts: { gap: 8 },
  question: { alignSelf: 'flex-end', borderRadius: 16, maxWidth: '90%', padding: 12 },
  answerTitle: { fontSize: 22, lineHeight: 28 },
  answerSection: { fontSize: 18, lineHeight: 24 },
  answerParagraph: { fontSize: 14, lineHeight: 20 },
  docked: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footer: { paddingHorizontal: guideContentInset },
  composer: { width: '100%', maxWidth: guideContentMaxWidth - 2 * guideContentInset, alignSelf: 'center', marginBottom: 12, gap: 8, borderRadius: composerRadius },
  composerRow: { gap: 4, paddingVertical: 4, paddingLeft: 12, paddingRight: 4 },
  composerAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
