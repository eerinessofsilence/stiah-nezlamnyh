import { useIsFocused } from 'expo-router/react-navigation';
import { Fragment, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, type ScrollViewInstance, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-screens/experimental';

import { preparation, services } from '../../data/catalog';
import { hotline, localContacts } from '../../data/contacts';
import { ExternalLink, GuideButton, guideContentInset, guideContentMaxWidth, GuideIcon, GuidePanel, GuidePressable, GuideScreen, GuideText, hasNativeHomeTabs, icons, RouteLink } from '../../guide';
import { useGuideState } from '../../guide-state';
import { BookmarkButton, ProgressUnavailable, RouteAction, RouteSources } from '../../route-actions';
import { type AnswerChoice, answerSections, findContacts, localAnswers } from '../../search';
import { GuideInputFrame, GuideInputPlaceholder } from '../../form-controls';
import { useGuideColors } from '../../theme';
import { typography } from '../../typography';
import { replyPresentation } from '../../assistant-reply';
import { motion, useReducedMotion } from '../../guide-motion';

const prompts = [
  'Які документи потрібні для УБД?',
  'Чи потрібна інвалідність для протеза?',
  'Яка знижка на комунальні послуги?',
  'Що робити після поранення?',
];
type Turn = { id: number; question: string; answers: AnswerChoice[] };

export default function AssistantScreen() {
  const colors = useGuideColors();
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const screenFocused = useRef(focused);
  const ios = Platform.OS === 'ios';
  const { top, bottom } = useSafeAreaInsets();
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

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) return;

    setQuestion('');
    Keyboard.dismiss();
    const answers = localAnswers(services, trimmed, previous.current);
    previous.current = answers.length === 1 ? answers[0] : null;
    const id = nextId.current++;
    revealTurn.current = id;
    setTurns(history => [...history, { id, question: trimmed, answers }]);
    if (screenFocused.current) AccessibilityInfo.announceForAccessibility(answers.length > 1 ? 'Уточніть запит' : answers.length ? 'Відповідь готова' : 'Відповіді не знайдено');
  }

  function clarify(id: number, choice: AnswerChoice) {
    const turn = turns.find(item => item.id === id);
    if (!turn) return;
    const service = services.find(item => item.id === choice.route);
    const matches = !choice.section && service ? answerSections(service, turn.question) : [];
    const answers = matches.length ? matches.map(({ id }) => ({ route: choice.route, section: id })) : [choice];
    if (id === turns.at(-1)?.id) previous.current = answers.length === 1 ? answers[0] : null;
    setTurns(history => history.map(item => item.id === id ? { ...item, answers } : item));
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

  const canSend = question.trim().length > 0;
  const composer = (
    <View style={styles.composer}>
      <GuideInputFrame focused={composerFocused} radius={16} style={styles.composerRow}>
        <View style={styles.inputWrap}><TextInput
          accessibilityLabel="Запитання Характернику"
          value={question}
          onChangeText={setQuestion}
          onFocus={() => setComposerFocused(true)}
          onBlur={() => setComposerFocused(false)}
          autoComplete="off"
          returnKeyType="send"
          onSubmitEditing={({ nativeEvent }) => submit(nativeEvent.text)}
          maxLength={500}
          style={[typography.body, styles.input, { color: colors.foreground }]}
        />{question === '' && <GuideInputPlaceholder>Напишіть запитання</GuideInputPlaceholder>}</View>
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
        <ImageBackground
          source={require('../../../assets/coast.webp')}
          style={[styles.intro, { backgroundColor: colors.hero }]}
          imageStyle={styles.illustration}
        >
          <View pointerEvents="none" style={[styles.shade, { experimental_backgroundImage: colors.heroGradient }]} />
          <GuideText type="title" tone="onHero">Характерник</GuideText>
          <GuideText type="support" tone="onHero">Запитайте про документи, пільги, лікування або допомогу на Одещині.</GuideText>
        </ImageBackground>
        {turns.length === 0 && <View style={styles.prompts}>
          {prompts.map(label => (
            <GuideButton key={label} label={label} row icon={icons.arrow} onPress={() => submit(label)} />
          ))}
        </View>}
        {turns.map((turn) => (
          <Fragment key={turn.id}>
            <View style={[styles.question, { backgroundColor: colors.feature }]}>
              <GuideText type="support" tone="onFeature">{turn.question}</GuideText>
            </View>
            <ReplyAppearance pending={revealTurn.current === turn.id} onReveal={y => revealReply(turn.id, y)}>
              <AssistantAnswer turn={turn} onChoose={choice => clarify(turn.id, choice)} />
            </ReplyAppearance>
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

function AssistantAnswer({ turn, onChoose }: { turn: Turn; onChoose: (choice: AnswerChoice) => void }) {
  const { progress } = useGuideState();
  if (turn.answers.length > 1) {
    return (
      <GuidePanel>
        <GuideText type="section">Що саме вас цікавить?</GuideText>
        {turn.answers.map(choice => {
          const service = services.find(item => item.id === choice.route);
          const section = service?.sections.find(item => item.id === choice.section);
          return service && <GuideButton key={choice.route + choice.section} label={section?.title ?? service.title}
            row icon={icons.arrow} onPress={() => onChoose(choice)} />;
        })}
      </GuidePanel>
    );
  }
  const choice = turn.answers[0];
  const service = services.find(item => item.id === choice?.route);
  if (!service) {
    return (
      <GuidePanel>
        <GuideText type="support">У гіді немає підтвердженої відповіді на це запитання. Уточніть, про яку послугу йдеться, або зверніться на обласну ветеранську лінію.</GuideText>
        <ExternalLink url={hotline.dial} label={hotline.phone} variant="primary" icon={icons.phone} />
      </GuidePanel>
    );
  }

  const section = service.sections.find(item => item.id === choice.section);
  const checklist = preparation[service.id];
  const local = service.id === 'escort' && findContacts(localContacts, turn.question)[0];
  return (
    <GuidePanel>
      <GuideText type={local ? 'section' : 'sheetTitle'}>{local ? local.title : section?.title ?? service.title}</GuideText>
      {local ? <>
        <GuideText>{local.description}</GuideText>
        {local.details && <GuideText>{local.details}</GuideText>}
        <ExternalLink url={local.dial} label={local.phone} icon={icons.phone} fullWidth />
      </> : section ? section.paragraphs.map(paragraph => <GuideText key={paragraph}>{paragraph}</GuideText>)
        : <GuideText>{service.steps[0]}</GuideText>}
      {!section && !local && <GuideText type="support">Уточніть, яка саме процедура або умова вас цікавить.</GuideText>}
      {!section && !local && service.sections.map(item => <GuideButton key={item.id} label={item.title}
        row icon={icons.arrow} onPress={() => onChoose({ route: service.id, section: item.id })} />)}
      <RouteAction action={section?.action ?? service.action} />
      <RouteLink id={service.id} section={section?.id} />
      {progress ? <BookmarkButton id={service.id} /> : <ProgressUnavailable />}
      <RouteSources key={service.id + (section?.id ?? '')}
        sourceKeys={[...new Set([...service.source, checklist?.source, local ? local.source : undefined].filter(key => key !== undefined))]} />
    </GuidePanel>
  );
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
  composer: { width: '100%', maxWidth: guideContentMaxWidth - 2 * guideContentInset, alignSelf: 'center', marginBottom: 12 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, padding: 4 },
  inputWrap: { flex: 1, minWidth: 0, minHeight: 52, justifyContent: 'center' },
  input: { flex: 1, alignSelf: 'stretch', minHeight: 52, paddingHorizontal: 8, paddingTop: 0, paddingBottom: 10, includeFontPadding: false, textAlignVertical: 'center' },
  send: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
