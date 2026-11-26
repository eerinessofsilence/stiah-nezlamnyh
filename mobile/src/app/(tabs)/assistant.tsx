import { useRouter } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { setStringAsync } from 'expo-clipboard';
import { Fragment, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, BackHandler, Easing, Keyboard, KeyboardAvoidingView, Platform, type HostInstance, type ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-screens/experimental';

import { checkedOn, preparation, revision, services, sources } from '../../data/catalog';
import { hotline, localContacts } from '../../data/contacts';
import { ExternalLink, GuideButton, guideContentInset, guideContentMaxWidth, GuideIcon, GuideIconButton, GuidePressable, GuideScreen, GuideStateIcon, GuideText, icons, RouteLink } from '../../guide';
import { useGuideState } from '../../guide-state';
import { RouteAction, RouteSources } from '../../route-actions';
import { type AnswerChoice, type CatalogReply, answerSections, conversationReplies, findContacts, localCatalogReply, parseCatalogReply } from '../../search';
import { GuideInputFrame, GuideTextInput, guideInputActionStyle } from '../../form-controls';
import { useGuideColors } from '../../theme';
import { useAssistantAudio } from '../../assistant-audio';
import { AssistantRecordingBar } from '../../assistant-recording-bar';
import { AssistantVoiceView } from '../../assistant-voice-view';
import { useAssistantChats } from '../../assistant-chat-state';
import { appendVoiceDraft, type Turn } from '../../assistant-chats';
import { localConversation, catalogOverview, nextConversationText, replyPresentation } from '../../assistant-reply';
import { askAssistantConsent, askVoiceConsent, devAssistantEndpoint, storeAssistantEndpoint, storeVoiceEndpoint } from '../../assistant-online';
import { focusGuideControl, motion, useGuideTransition, useReducedMotion } from '../../guide-motion';
import type { GuideIconName } from '../../guide-icons';

const prompts = [
  'Які документи потрібні для УБД?',
  'Чи потрібна інвалідність для протеза?',
  'Яка знижка на комунальні послуги?',
  'Що робити після поранення?',
];
const composerRadius = 18;
const questionTailWidth = 7;
const answerActionIconInset = 3;
const onlineEndpoint = devAssistantEndpoint ?? storeAssistantEndpoint;
const devRemote = devAssistantEndpoint?.startsWith('https://');
const noAnswer = 'У гіді поки немає підтвердженої відповіді. Скажіть, будь ласка, про яку послугу йдеться. Можна також зателефонувати на обласну ветеранську лінію.';
const chooseTopic = 'Що розберемо спочатку?';
const partialAnswer = 'На інші частини запитання в гіді немає підтвердженої відповіді.';

function describeAnswer(question: string, choice: AnswerChoice) {
  const service = services.find(item => item.id === choice?.route);
  if (!service) return null;
  const section = service.sections.find(item => item.id === choice.section);
  const local = service.id === 'escort' && findContacts(localContacts, question)[0] || undefined;
  const overview = !section && !local ? catalogOverview(service) : undefined;
  const paragraphs = local ? [local.description, local.details].filter((part): part is string => Boolean(part)) :
    section && choice.paragraphs ? choice.paragraphs.map(id => section.paragraphs[id - 1]) : section?.paragraphs ?? [];
  const title = local?.title ?? section?.title ?? service.title;
  const text = overview ? [overview.intro, ...overview.topics.map(topic => `${topic.title}. ${topic.paragraphs[0]}`)].join(' ') :
    paragraphs.join(' ');
  return { service, section, local, overview, paragraphs, title, text };
}

function answerText(question: string, { answers, mode, conversation, text: generatedText }: CatalogReply, conversationText?: string, copy = false) {
  if (generatedText) return generatedText;
  if (conversation) return conversationText ?? conversationReplies[conversation];
  const separator = copy ? '\n\n' : ' ';
  if (!answers.length) return copy ? [noAnswer, hotline.phone].join(separator) : noAnswer;
  const material = answers.map(choice => describeAnswer(question, choice)).filter(item => item !== null);
  if (mode === 'clarify') return [chooseTopic, ...material.map(item => item.title)].join(copy ? '\n' : ' ');
  const text = material.map(item => {
    if (!copy) return material.length > 1 ? `${item.title}. ${item.text}` : item.text;
    const paragraphs = item.overview
      ? [item.overview.intro, ...item.overview.topics.map(topic => [topic.title, topic.paragraphs[0]].join('\n'))]
      : item.paragraphs;
    return [item.title, ...paragraphs].join(separator);
  });
  return [...text, mode === 'partial' ? partialAnswer : ''].filter(Boolean).join(separator);
}

export default function AssistantScreen() {
  const router = useRouter();
  const { activeId, chats, getChat, getActiveId, updateChat } = useAssistantChats();
  const { turns, question, voiceDraft } = chats.find(chat => chat.id === activeId)!;
  const loading = turns.some(turn => !turn.answers);
  const colors = useGuideColors();
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const screenFocused = useRef(focused);
  const ios = Platform.OS === 'ios';
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.4;
  const { offline, assistantConsent, saveAssistantConsent, voiceConsent, saveVoiceConsent } = useGuideState();
  const [capabilities, setCapabilities] = useState<{ voice: boolean; speech: boolean }>();
  const [token, setToken] = useState('');
  const [tokenFocused, setTokenFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [speakingTurn, setSpeakingTurn] = useState<number>();
  const revealTurn = useRef<number | null>(null);
  const replyScroll = useRef<number | null>(null);
  const viewport = useRef({ offset: 0, height: 0, inset: 0 });
  const scroll = useRef<ScrollViewInstance>(null);
  const composerAction = useRef<HostInstance>(null);
  const historyTrigger = useRef<HostInstance>(null);
  const returnFromHistory = useRef(false);
  const [voiceMode, setVoiceMode] = useState<'full' | 'compact' | null>(null);
  const voiceExpanded = voiceMode === 'full';
  const transcriptOpacity = useGuideTransition(voiceExpanded ? 0 : 1, motion.appear);
  const voiceTrigger = useRef<HostInstance>(null);
  const returnFromVoice = useRef(false);
  const followLive = useRef(false);
  const devToken = token.trim();
  const devOnline = Boolean(devAssistantEndpoint && (!devRemote || devToken) && !offline);
  const voiceEndpoint = devAssistantEndpoint ?? storeVoiceEndpoint;
  const checkVoice = Boolean(voiceEndpoint && !offline && (devOnline || storeVoiceEndpoint));
  const voiceEnabled = checkVoice && capabilities?.voice === true;
  const serverSpeech = devOnline && capabilities?.speech === true;
  const audio = useAssistantAudio({
    endpoint: voiceEndpoint, token: devToken, active: voiceEnabled && focused &&
      (!voiceMode || voiceEndpoint !== storeVoiceEndpoint || voiceConsent), playbackActive: focused, serverSpeech,
    onDraft: text => updateChat(activeId, chat => appendVoiceDraft(chat, text)),
    onQuestion: text => submit(text, true),
  });
  const toggleVoice = useCallback(() => {
    setVoiceMode(current => current && (current === 'full' ? 'compact' : 'full'));
  }, []);
  const endVoice = useCallback(() => {
    audio.cancel();
    followLive.current = false;
    setVoiceMode(null);
  }, [audio.cancel]);

  useEffect(() => {
    if (!focused) return;
    setCapabilities(undefined);
    if (!checkVoice || !voiceEndpoint) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 6000);
    const headers: Record<string, string> = devToken ? { Authorization: 'Bearer ' + devToken } : {};
    void fetch(voiceEndpoint, { headers, signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const status = await response.json();
        const currentRevision = status.revision === revision;
        return { voice: currentRevision && status.voice === true, speech: currentRevision && status.speech === true };
      })
      .then(available => { if (!controller.signal.aborted) setCapabilities(available); })
      .catch(() => {
        if (!controller.signal.aborted || controller.signal.reason === 'timeout') setCapabilities({ voice: false, speech: false });
      })
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [focused, checkVoice, voiceEndpoint, devToken]);

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
    if (!focused || !returnFromHistory.current) return;
    const frame = requestAnimationFrame(() => {
      focusGuideControl(historyTrigger.current);
      returnFromHistory.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [focused]);

  useEffect(() => {
    if (!voiceMode || audio.phase !== 'idle') return;
    followLive.current = false;
    setVoiceMode(null);
  }, [audio.phase, voiceMode]);

  useEffect(() => {
    if (!focused || !returnFromVoice.current) return;
    const frame = requestAnimationFrame(() => {
      focusGuideControl(voiceMode ? voiceTrigger.current : composerAction.current);
      if (!voiceMode) returnFromVoice.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [focused, voiceMode]);

  useEffect(() => {
    if (!focused || !voiceMode) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (voiceExpanded) toggleVoice();
      else endVoice();
      return true;
    });
    return () => back.remove();
  }, [endVoice, focused, toggleVoice, voiceExpanded, voiceMode]);

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

  async function submit(text: string, fromLive = false, retryId?: number) {
    const trimmed = text.trim();
    const chat = getChat(activeId);
    const previous = chat?.turns.at(-1);
    if (!chat || !trimmed || trimmed.length > 500 || chat.turns.some(turn => !turn.answers)) return;

    const id = retryId ?? (previous?.id ?? -1) + 1;
    if (retryId !== undefined && !chat.turns.some(turn => turn.id === retryId)) return;
    if (!fromLive && audio.speaking) audio.stopSpeech();
    revealTurn.current = fromLive && !followLive.current ? null : id;
    const pending = { id, question: trimmed };
    updateChat(activeId, current => retryId === undefined ? ({
      ...current, turns: [...current.turns, pending],
      ...(!fromLive && { question: '', voiceDraft: false }),
    }) : ({ ...current, turns: current.turns.map(turn => turn.id === id ? pending : turn) }));
    if (!fromLive) Keyboard.dismiss();
    const previousQuestion = chat.turns.findLast(turn => turn.id < id && (turn.answers?.length || turn.text));
    const previousAnswers = previousQuestion?.answers ?? [];
    const previousRoute = previousAnswers[0]?.route;
    const context = previousAnswers.length === 1 ? { route: previousAnswers[0].route, section: previousAnswers[0].section } :
      previousRoute && previousAnswers.every(item => item.route === previousRoute) ? { route: previousRoute, section: null } : null;
    function replyOnDevice(): CatalogReply {
      const conversation = localConversation(trimmed);
      return conversation ? { answers: [], mode: 'answer', conversation } : localCatalogReply(services, trimmed, context);
    }
    let reply: CatalogReply;
    let fallback: string | undefined;
    let storeOnline = Boolean(storeAssistantEndpoint && !offline && (fromLive || assistantConsent === true));
    if (storeAssistantEndpoint && !offline && !fromLive && assistantConsent === null) {
      const allowed = await askAssistantConsent(true);
      storeOnline = saveAssistantConsent(allowed) && allowed;
    }
    if ((devOnline || storeOnline) && onlineEndpoint) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 11000);
      try {
        const response = await fetch(onlineEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(devToken && { Authorization: 'Bearer ' + devToken }),
          },
          body: JSON.stringify({ question: trimmed, previous: context, revision, conversationVersion: 3 }),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 409) fallback = 'Версії гіда різняться. Показую результат пошуку на пристрої.';
          if (response.status === 403 && devRemote) fallback = 'Перевірте код доступу. Показую результат пошуку на пристрої.';
          throw new Error();
        }
        reply = parseCatalogReply(services, await response.json());
      } catch {
        fallback ??= 'Онлайн-помічник недоступний. Показую результат пошуку на пристрої.';
        reply = replyOnDevice();
      } finally {
        clearTimeout(timeout);
      }
    } else {
      reply = replyOnDevice();
    }
    const recentConversation = reply.conversation && chat.turns.findLast(turn =>
      turn.conversation === reply.conversation && turn.id <= id);
    const conversationText = reply.conversation && nextConversationText(reply.conversation, conversationReplies[reply.conversation],
      recentConversation?.conversationText ?? (recentConversation ? conversationReplies[reply.conversation] : undefined));
    updateChat(activeId, current => ({
      ...current, turns: current.turns.map(turn => turn.id === id ? { ...turn, ...reply, fallback, conversationText } : turn),
    }));
    if (!fromLive && screenFocused.current && getActiveId() === activeId) {
      AccessibilityInfo.announceForAccessibility(reply.text ?? conversationText ??
        (reply.mode === 'clarify' ? 'Уточніть запит' : reply.answers.length ? 'Відповідь готова' : 'Відповіді не знайдено'));
    }
    return [fallback, answerText(trimmed, reply, conversationText)].filter(Boolean).join(' ');
  }

  function clarify(id: number, choice: AnswerChoice) {
    const turn = turns.find(item => item.id === id);
    if (!turn?.answers) return;
    const service = services.find(item => item.id === choice.route);
    const matches = !choice.section && service ? answerSections(service, turn.question) : [];
    const answers = matches.length ? matches.map(({ id }) => ({ route: choice.route, section: id })) : [choice];
    updateChat(activeId, current => ({ ...current, turns: current.turns.map(item => item.id === id ? { ...item, answers, mode: answers.length > 1 ? 'clarify' : 'answer' } : item) }));
    AccessibilityInfo.announceForAccessibility('Запит уточнено');
  }

  function revealReply(id: number, y: number, answerHeight: number) {
    const follow = revealTurn.current === id && focused;
    const { offset, height, inset } = viewport.current;
    const presentation = replyPresentation(y, answerHeight, offset + inset, offset + height, follow, reduced);
    if (presentation === 'scroll' || presentation === 'jump') {
      // Let the native scroll view commit its new content height before it clamps the offset.
      requestAnimationFrame(() => {
        if (revealTurn.current !== id || !screenFocused.current) return;
        revealTurn.current = null;
        const currentInset = viewport.current.inset;
        const target = Math.max(-currentInset, y - currentInset - 12);
        replyScroll.current = presentation === 'scroll' ? target : null;
        scroll.current?.scrollTo({ y: target, animated: presentation === 'scroll' });
      });
    } else if (follow) {
      revealTurn.current = null;
    }
    return presentation === 'fade';
  }

  const busyAudio = voiceMode !== null || audio.phase !== 'idle';
  const questionLength = question.trim().length;
  const composerReady = !loading && !busyAudio;
  const canSend = composerReady && questionLength > 0 && questionLength <= 500;
  const showLiveAction = voiceEnabled && questionLength === 0;
  const actionEnabled = showLiveAction ? composerReady : canSend;
  const inputLimit = voiceDraft ? Math.max(500, question.length) : 500;
  async function allowVoice() {
    if (!voiceEnabled || !voiceEndpoint) return false;
    if (voiceEndpoint === storeVoiceEndpoint && !voiceConsent) {
      if (!await askVoiceConsent() || !screenFocused.current || getActiveId() !== activeId) return false;
      return saveVoiceConsent(true);
    }
    return true;
  }

  async function recordVoice() {
    if (!await allowVoice()) return;
    Keyboard.dismiss();
    void audio.startRecording();
  }

  async function openVoice() {
    if (!voiceEnabled || !voiceEndpoint) return;
    if (!audio.voice && !serverSpeech) {
      Alert.alert('Потрібен український голос', 'Додайте український голос у налаштуваннях пристрою.');
      return;
    }
    if (!await allowVoice()) return;
    Keyboard.dismiss();
    returnFromVoice.current = true;
    followLive.current = true;
    setSpeakingTurn(undefined);
    setVoiceMode('full');
    void audio.startLive();
  }
  const historyAction = (
    <GuideIconButton ref={historyTrigger} icon="chats" label="Історія чатів" disabled={busyAudio} onPress={() => {
      Keyboard.dismiss();
      returnFromHistory.current = true;
      router.push('/assistant-chats');
    }} />
  );
  const fixedHeader = largeText ? undefined : (
    <View style={styles.titleRow}>
      <GuideText type="sheetTitle" style={styles.titleText}>Характерник</GuideText>
      {historyAction}
    </View>
  );
  // Break at a syllable boundary if the large title exceeds the full content width.
  const scrollingTitle = largeText ? 'Характер\u00ADник' : undefined;
  const composer = (
    <View style={[styles.composer, { backgroundColor: colors.background }]}>
      {!!audio.error && <GuideText type="support" announcement>{audio.error}</GuideText>}
      {voiceDraft && questionLength > 500 && <GuideText type="support" announcement>Скоротіть запитання до 500 символів.</GuideText>}
      {audio.phase === 'recording' || audio.phase === 'transcribing' ? (
        <AssistantRecordingBar recorder={audio.recorder} phase={audio.phase} onCancel={audio.cancel}
          onTranscribe={() => void audio.finishRecording('transcribe')} />
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
          submitBehavior="submit"
          maxLines={4}
          onSubmitEditing={({ nativeEvent }) => { if (canSend) void submit(nativeEvent.text); }}
          editable={!busyAudio}
          maxLength={inputLimit}
        />
        {voiceEnabled && <GuidePressable accessibilityRole="button" accessibilityLabel={questionLength ? 'Доповнити голосом' : 'Записати повідомлення'}
          accessibilityState={{ disabled: !composerReady }} disabled={!composerReady}
          onPress={() => void recordVoice()}
          style={[guideInputActionStyle, { backgroundColor: composerReady ? colors.surfaceSoft : colors.surfaceMuted }]}>
          <GuideIcon name="microphone" color={composerReady ? colors.foreground : colors.foregroundMuted} size={20} />
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
          style={[guideInputActionStyle, { backgroundColor: actionEnabled ? colors.feature : colors.surfaceMuted }]}>
          <GuideStateIcon name="paper-plane-right-fill" selectedName="waveform" selected={showLiveAction}
            color={actionEnabled ? colors.onFeature : colors.foregroundMuted} size={20} />
        </GuidePressable>
      </GuideInputFrame>}
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={ios ? 'padding' : undefined}>
      <View style={styles.flex}>
        <Animated.View style={[styles.flex, { opacity: transcriptOpacity }]}
          pointerEvents={voiceExpanded ? 'none' : 'auto'} accessibilityElementsHidden={voiceExpanded}
          importantForAccessibility={voiceExpanded ? 'no-hide-descendants' : 'auto'}>
          <GuideScreen fixedHeader={fixedHeader} title={scrollingTitle} titleType="sheetTitle"
            titleAction={largeText ? historyAction : undefined} scrollRef={scroll}
            onLayout={({ nativeEvent }) => { viewport.current.height = nativeEvent.layout.height; }}
            onScroll={({ nativeEvent }) => {
              const offset = nativeEvent.contentOffset.y;
              const inset = nativeEvent.contentInset.top;
              viewport.current = { offset, height: nativeEvent.layoutMeasurement.height, inset };
              if (replyScroll.current !== null && Math.abs(replyScroll.current - offset) <= 1) replyScroll.current = null;
              if (voiceMode === 'compact' && !followLive.current &&
                  offset + nativeEvent.layoutMeasurement.height >= nativeEvent.contentSize.height + nativeEvent.contentInset.bottom - 24) {
                followLive.current = true;
              }
            }}
            onScrollBeginDrag={() => {
              followLive.current = false;
              revealTurn.current = null;
              replyScroll.current = null;
            }}
            onMomentumScrollEnd={() => { replyScroll.current = null; }}>
            {devRemote && <GuideInputFrame focused={tokenFocused}>
              <GuideTextInput value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false}
                editable={!loading && !busyAudio} onFocus={() => setTokenFocused(true)} onBlur={() => setTokenFocused(false)}
                accessibilityLabel="Код доступу до Dev" placeholder="Код доступу до Dev" compactPlaceholder="Код Dev" />
            </GuideInputFrame>}
            {devOnline && capabilities?.voice === false && <GuideText type="meta" tone="foregroundMuted">Голосовий режим зараз недоступний.</GuideText>}
            {turns.length === 0 && <View style={styles.prompts}>
              {prompts.map(label => (
                <GuideButton key={label} label={label} row icon={icons.arrow} disabled={loading || busyAudio} onPress={() => void submit(label)} />
              ))}
            </View>}
            {turns.map((turn) => (
              <Fragment key={`${activeId}:${turn.id}`}>
                <View style={[styles.question, { backgroundColor: colors.feature }]}>
                  <View pointerEvents="none" style={[styles.questionTail, { backgroundColor: colors.feature }]}>
                    <View style={[styles.questionTailCut, { backgroundColor: colors.background }]} />
                  </View>
                  <GuideText type="body" tone="onFeature">{turn.question}</GuideText>
                </View>
                {turn.answers ? <ReplyAppearance pending={revealTurn.current === turn.id} onReveal={(y, height) => revealReply(turn.id, y, height)}>
                  <AssistantAnswer turn={turn} answers={turn.answers} onChoose={choice => clarify(turn.id, choice)}
                    onRetry={() => void submit(turn.question, false, turn.id)} actionsDisabled={!composerReady}
                    speaking={audio.speaking && speakingTurn === turn.id} onSpeak={text => {
                      if (audio.speaking && speakingTurn === turn.id) audio.stopSpeech();
                      else {
                        setSpeakingTurn(turn.id);
                        audio.speak(text);
                      }
                    }} />
                </ReplyAppearance> : <AnswerLoading />}
              </Fragment>
            ))}
          </GuideScreen>
        </Animated.View>
        {voiceMode ? (
          <View style={voiceExpanded ? StyleSheet.absoluteFill : styles.composerArea}>
            <AssistantVoiceView audio={audio} compact={!voiceExpanded} orbRef={voiceTrigger}
              onToggle={toggleVoice} onEnd={endVoice} />
          </View>
        ) : (
          <SafeAreaView edges={ios ? { bottom: !keyboardOpen, left: true, right: true } : {}}
            pointerEvents="box-none" style={styles.composerArea}>
            <View pointerEvents="box-none" style={styles.footer}>
              {composer}
            </View>
          </SafeAreaView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function ReplyAppearance({ pending, onReveal, children }: { pending: boolean; onReveal: (y: number, height: number) => boolean; children: ReactNode }) {
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
    if (onReveal(nativeEvent.layout.y, nativeEvent.layout.height)) {
      Animated.timing(opacity, {
        toValue: 1, duration: motion.appear, easing: motion.easeOut, useNativeDriver: true, isInteraction: false,
      }).start();
    } else {
      opacity.setValue(1);
    }
  }}>{children}</Animated.View>;
}

function AnswerLoading() {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  const label = 'Шукаю відповідь…';
  const widthOfBand = Math.min(width * 0.33, 46);
  useEffect(() => {
    if (reduced || width === 0) return;
    const sweep = Animated.loop(Animated.timing(progress, {
      toValue: 1, duration: motion.shimmer, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }));
    sweep.start();
    return () => { sweep.stop(); progress.setValue(0); };
  }, [progress, reduced, width]);

  return <View style={styles.answerLoading} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <GuideText type="support" tone="foregroundMuted" announcement>{label}</GuideText>
    {!reduced && width > 0 && <View pointerEvents="none" accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={styles.shimmerOverlay}>
      {[1, 0.73, 0.44].map((fraction, index) => {
        const translateX = progress.interpolate({
          inputRange: [0, 1], outputRange: [-widthOfBand / 2 - widthOfBand * fraction / 2, width + widthOfBand * (1 - fraction) / 2],
        });
        return <Animated.View key={fraction} style={[styles.shimmerBand, {
          width: widthOfBand * fraction, opacity: index === 0 ? 0.22 : index === 1 ? 0.4 : 0.85,
          transform: [{ translateX }],
        }]}>
          <Animated.View style={{ width, transform: [{ translateX: Animated.multiply(translateX, -1) }] }}>
            <GuideText type="support">{label}</GuideText>
          </Animated.View>
        </Animated.View>;
      })}
    </View>}
  </View>;
}

function AnswerActions({ onCopy, onSpeak, onRetry, disabled, speaking }: {
  onCopy: () => string; onSpeak: () => void; onRetry: () => void; disabled: boolean; speaking: boolean;
}) {
  const colors = useGuideColors();
  const [copied, setCopied] = useState(false);
  const resetCopy = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(resetCopy.current), []);

  async function copy() {
    try {
      if (!await setStringAsync(onCopy())) throw new Error('Clipboard unavailable');
      clearTimeout(resetCopy.current);
      setCopied(true);
      resetCopy.current = setTimeout(() => setCopied(false), 2000);
      if (Platform.OS !== 'android' || Number(Platform.Version) < 33) AccessibilityInfo.announceForAccessibility('Скопійовано');
    } catch {
      Alert.alert('Не вдалося скопіювати відповідь');
    }
  }

  function action(icon: GuideIconName, label: string, onPress: () => void, { selected = false, selectedIcon, iconOffset = 0 }: {
    selected?: boolean; selectedIcon?: GuideIconName; iconOffset?: number;
  } = {}) {
    return <GuidePressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled, ...(selected && { selected }) }} disabled={disabled} onPress={onPress}
      style={[styles.answerAction, {
        paddingLeft: Math.max(0, iconOffset * 2), paddingRight: Math.max(0, -iconOffset * 2),
      }]}>
      {selectedIcon ? <GuideStateIcon name={icon} selectedName={selectedIcon} selected={selected} size={20}
        color={colors.foregroundMuted} selectedColor={colors.accent} /> :
        <GuideIcon name={icon} size={20} color={colors.foregroundMuted} />}
    </GuidePressable>;
  }

  return <View style={styles.answerActions}>
    {action('copy', copied ? 'Відповідь скопійовано' : 'Скопіювати відповідь', () => void copy(),
      { selected: copied, selectedIcon: 'check', iconOffset: answerActionIconInset })}
    {action('speaker-high', speaking ? 'Зупинити озвучення' : 'Прослухати відповідь', onSpeak,
      { selected: speaking, selectedIcon: 'stop-fill' })}
    {action('arrow-clockwise', 'Повторити запит', onRetry, { iconOffset: -answerActionIconInset })}
  </View>;
}

function AssistantAnswer({ turn, answers, onChoose, onSpeak, onRetry, actionsDisabled, speaking }: {
  turn: Turn; answers: AnswerChoice[]; onChoose: (choice: AnswerChoice) => void; onSpeak: (text: string) => void;
  onRetry: () => void; actionsDisabled: boolean; speaking: boolean;
}) {
  const shortReply = turn.text ?? (turn.conversation && (turn.conversationText ?? conversationReplies[turn.conversation]));
  const mode = turn.mode ?? (answers.length > 1 ? 'clarify' : 'answer');
  const reply = { answers, mode, conversation: turn.conversation, text: turn.text };
  return <View style={styles.answer}>
    {turn.fallback && <GuideText type="meta" tone="foregroundMuted">{turn.fallback} Знімок гіда від {checkedOn}.</GuideText>}
    {shortReply ? <GuideText>{shortReply}</GuideText> : mode === 'clarify' ? <>
      <GuideText type="section" style={styles.answerSection}>{chooseTopic}</GuideText>
      {answers.map(choice => {
        const topic = services.find(item => item.id === choice.route);
        const part = topic?.sections.find(item => item.id === choice.section);
        return topic && <GuideButton key={choice.route + choice.section} label={part?.title ?? topic.title}
          row icon={icons.arrow} onPress={() => onChoose(choice)} />;
      })}
    </> : !answers.length ? <>
      <GuideText>{noAnswer}</GuideText>
      <ExternalLink url={hotline.dial} label={hotline.phone} variant="primary" icon={icons.phone} />
    </> : <>
      {answers.map(choice => <CatalogAnswer key={choice.route + ':' + choice.section} question={turn.question} choice={choice} onChoose={onChoose} />)}
      {mode === 'partial' && <GuideText tone="foregroundMuted">{partialAnswer}</GuideText>}
    </>}
    <AnswerActions onCopy={() => answerText(turn.question, reply, shortReply, true)}
      onSpeak={() => onSpeak(answerText(turn.question, reply, shortReply))}
      onRetry={onRetry} disabled={actionsDisabled} speaking={speaking} />
  </View>;
}

function CatalogAnswer({ question, choice, onChoose }: { question: string; choice: AnswerChoice; onChoose: (choice: AnswerChoice) => void }) {
  const material = describeAnswer(question, choice);
  if (!material) return null;
  const { service, section, local, overview, paragraphs, title } = material;
  const checklist = preparation[service.id];
  const actionKey = section?.action?.[0];
  const sourceKeys = local ? [local.source] : section?.source ?? [...new Set([
    ...(actionKey && sources[actionKey] ? [actionKey] : []),
    ...(checklist?.section === section?.id && checklist?.source ? [checklist.source] : []),
    ...service.source,
    ...(overview?.topics.flatMap(topic => topic.source ?? []) ?? []),
  ])];
  return <>
    <GuideText type={local ? 'section' : 'sheetTitle'} style={local ? styles.answerSection : styles.answerTitle}>{title}</GuideText>
    {overview && <>
      <GuideText>{overview.intro}</GuideText>
      {overview.topics.map(topic => <Fragment key={topic.id}>
        <GuideText type="item" heading>{topic.title}</GuideText>
        <GuideText>{topic.paragraphs[0]}</GuideText>
      </Fragment>)}
    </>}
    {paragraphs.map(paragraph => <GuideText key={paragraph}>{paragraph}</GuideText>)}
    {local && <ExternalLink url={local.dial} label={local.phone} icon={icons.phone} fullWidth />}
    {overview && service.sections.map(item => <GuideButton key={item.id} label={item.title}
      row icon={icons.arrow} onPress={() => onChoose({ route: service.id, section: item.id })} />)}
    <RouteAction action={section?.action ?? (section?.definition ? undefined : service.action)} />
    <RouteLink id={service.id} section={section?.id} />
    <RouteSources key={service.id + (section?.id ?? '')} sourceKeys={sourceKeys} />
  </>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8,
    width: '100%', maxWidth: guideContentMaxWidth, paddingTop: 12, paddingHorizontal: guideContentInset,
  },
  titleText: { flex: 1 },
  prompts: { gap: 8 },
  question: { alignSelf: 'flex-end', borderRadius: 18, borderBottomRightRadius: 6, marginRight: questionTailWidth, maxWidth: '90%', padding: 12 },
  questionTail: { position: 'absolute', bottom: 0, right: -questionTailWidth, width: 16, height: 14 },
  questionTailCut: { position: 'absolute', right: -2, bottom: 0, width: questionTailWidth + 2, height: 14, borderBottomLeftRadius: 9 },
  answer: { gap: 8, paddingTop: 4, paddingBottom: 8 },
  answerLoading: { alignSelf: 'flex-start', maxWidth: '100%' },
  shimmerOverlay: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  shimmerBand: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
  answerActions: { flexDirection: 'row', marginLeft: -8 - answerActionIconInset, marginTop: -6 },
  answerAction: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  answerTitle: { fontSize: 20, lineHeight: 26 },
  answerSection: { fontSize: 18, lineHeight: 24 },
  composerArea: { flex: 0 },
  footer: { paddingHorizontal: guideContentInset },
  composer: { width: '100%', maxWidth: guideContentMaxWidth - 2 * guideContentInset, alignSelf: 'center', marginBottom: 12, gap: 8, borderRadius: composerRadius },
  composerRow: { alignItems: 'flex-end', gap: 4, paddingVertical: 4, paddingLeft: 12, paddingRight: 4 },
});
