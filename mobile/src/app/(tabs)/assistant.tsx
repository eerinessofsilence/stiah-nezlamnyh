import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, Pressable, type ScrollViewInstance, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-screens/experimental';

import { preparation, services } from '../../data/catalog';
import { hotline, localContacts } from '../../data/contacts';
import { ExternalLink, GuideButton, guideContentInset, guideContentMaxWidth, GuideIcon, GuidePanel, GuideScreen, GuideText, icons, RouteLink } from '../../guide';
import { useGuideState } from '../../guide-state';
import { BookmarkButton, ProgressUnavailable, RouteAction, RouteSources } from '../../route-actions';
import { type AnswerChoice, answerSections, findContacts, localAnswers, parseAiAnswers } from '../../search';
import { useGuideColors } from '../../theme';
import { typography } from '../../typography';

const prompts = [
  'Які документи потрібні для УБД?',
  'Чи потрібна інвалідність для протеза?',
  'Яка знижка на комунальні послуги?',
  'Що робити після поранення?',
];
// Store builds only search the bundled catalogue, including when an endpoint is configured locally.
const endpoint = __DEV__ ? process.env.EXPO_PUBLIC_ASSISTANT_URL : undefined;
const onlineEndpoint = endpoint && (endpoint.startsWith('https://') ||
  /^http:\/\/(localhost|127\.0\.0\.1):\d+\/api\/assistant$/.test(endpoint)) ? endpoint : undefined;

type Turn = { id: number; question: string; answers: AnswerChoice[]; source: 'model' | 'catalogue' };

export default function AssistantScreen() {
  const colors = useGuideColors();
  const focused = useIsFocused();
  const ios = Platform.OS === 'ios';
  const { top } = useSafeAreaInsets();
  const { offline } = useGuideState();
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const previous = useRef<AnswerChoice | null>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const nextId = useRef(0);
  const scrollToTurn = useRef<number | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

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

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending.current) return;

    pending.current = true;
    setQuestion('');
    Keyboard.dismiss();
    const context = previous.current;
    let answers = localAnswers(services, trimmed, context);
    let source: Turn['source'] = 'catalogue';
    if (online && onlineEndpoint && !offline) {
      setLoading(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 11000);
      try {
        const response = await fetch(onlineEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed, previous: context }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Assistant unavailable');
        const choices = parseAiAnswers(services, (await response.json()).answers);
        if (choices.length) {
          answers = choices;
          source = 'model';
        }
      } catch {
        // The built-in catalogue remains available when the server cannot answer.
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    }
    pending.current = false;
    previous.current = answers.length === 1 ? answers[0] : null;
    const id = nextId.current++;
    scrollToTurn.current = id;
    setTurns(history => [...history, { id, question: trimmed, answers, source }]);
    AccessibilityInfo.announceForAccessibility(answers.length > 1 ? 'Уточніть запит' : answers.length ? 'Відповідь готова' : 'Відповіді не знайдено');
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

  const canSend = !loading && question.trim().length > 0;
  const composer = (
    <View style={styles.composer}>
      <View style={[styles.composerRow, { backgroundColor: colors.surface, borderColor: colors.lineStrong }]}>
        <TextInput
          accessibilityLabel="Запитання Характернику"
          placeholder="Напишіть запитання"
          placeholderTextColor={colors.muted}
          value={question}
          onChangeText={setQuestion}
          autoComplete="off"
          returnKeyType="send"
          onSubmitEditing={({ nativeEvent }) => submit(nativeEvent.text)}
          maxLength={500}
          style={[typography.body, styles.input, { color: colors.ink }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Надіслати запитання"
          accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={() => submit(question)}
          style={({ pressed }) => [styles.send, {
            backgroundColor: canSend ? colors.feature : colors.surfaceMuted,
            opacity: pressed ? 0.75 : 1,
          }]}>
          <GuideIcon name={{ ios: 'paperplane.fill', android: 'send' }} color={canSend ? colors.onFeature : colors.muted} size={20} />
        </Pressable>
      </View>
      <GuideText type="meta" tone="muted">Не додавайте ПІБ, номери документів чи медичні дані.</GuideText>
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.canvas }]} behavior={ios ? 'padding' : undefined}>
      <GuideScreen scrollRef={scroll} footerHeight={ios ? footerHeight : 0}>
        <ImageBackground
          source={require('../../../assets/coast.webp')}
          style={styles.intro}
          imageStyle={styles.illustration}
        >
          <View pointerEvents="none" style={styles.shade} />
          <GuideText type="title" tone="onFeature">Характерник</GuideText>
          <GuideText type="support" style={styles.introCopy}>Запитайте про документи, пільги, лікування або допомогу на Одещині.</GuideText>
        </ImageBackground>
        {onlineEndpoint && <GuidePanel>
          <View style={styles.mode}>
            <GuideText type="support" style={styles.modeText}>Онлайн-помічник</GuideText>
            <Switch accessibilityLabel="Онлайн-помічник" value={online} onValueChange={setOnline} disabled={loading} />
          </View>
          <GuideText type="meta" tone="muted">У цьому режимі модель підбирає матеріал гіда. Запитання й тема попередньої відповіді надсилаються на сервер.</GuideText>
        </GuidePanel>}
        {loading && <GuideText type="support" announcement>Шукаю відповідь…</GuideText>}
        {turns.length === 0 && <View style={styles.prompts}>
          {prompts.map(label => (
            <GuideButton key={label} label={label} row icon={icons.arrow} disabled={loading} onPress={() => void submit(label)} />
          ))}
        </View>}
        {turns.map((turn) => (
          <View key={turn.id} style={styles.turn} onLayout={({ nativeEvent }) => {
            if (scrollToTurn.current !== turn.id) return;
            scrollToTurn.current = null;
            const y = Math.max(0, nativeEvent.layout.y - (ios ? top : 0) - 12);
            scroll.current?.scrollTo({ y, animated: false });
          }}>
            <View style={[styles.question, { backgroundColor: colors.feature }]}>
              <GuideText type="support" tone="onFeature">{turn.question}</GuideText>
            </View>
            <AssistantAnswer turn={turn} onChoose={choice => clarify(turn.id, choice)} />
          </View>
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

function AssistantAnswer({ turn, onChoose }: { turn: Turn; onChoose: (choice: AnswerChoice) => void }) {
  const { progress } = useGuideState();
  if (turn.answers.length > 1) {
    return (
      <GuidePanel>
        <GuideText type="item" heading>Що саме вас цікавить?</GuideText>
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
      <GuideText type="meta" tone="muted">{turn.source === 'model'
        ? 'Розділ підібрано моделлю · текст із гіда'
        : 'Відповідь із вбудованого гіда'}</GuideText>
      <GuideText type="item" heading>{local ? local.title : section?.title ?? service.title}</GuideText>
      {local ? <>
        <GuideText type="support">{local.description}</GuideText>
        {local.details && <GuideText type="support">{local.details}</GuideText>}
        <ExternalLink url={local.dial} label={local.phone} icon={icons.phone} fullWidth />
      </> : section ? section.paragraphs.map(paragraph => <GuideText type="support" key={paragraph}>{paragraph}</GuideText>)
        : <GuideText type="support">{service.steps[0]}</GuideText>}
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
  intro: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#142f30', paddingHorizontal: 20, paddingBottom: 24, paddingTop: 84, gap: 8 },
  illustration: { borderRadius: 24 },
  shade: { ...StyleSheet.absoluteFill, experimental_backgroundImage: 'linear-gradient(to top, #142f30eb, #142f30ae 22%, #142f3038 45%, #142f3000 60%)' },
  introCopy: { color: '#e0e5d8' },
  prompts: { gap: 8 },
  turn: { gap: 8 },
  question: { alignSelf: 'flex-end', borderRadius: 16, maxWidth: '90%', padding: 12 },
  docked: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footer: { paddingHorizontal: guideContentInset },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeText: { flex: 1 },
  composer: { width: '100%', maxWidth: guideContentMaxWidth - 2 * guideContentInset, alignSelf: 'center', gap: 6, marginBottom: 4 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, padding: 4 },
  input: { flex: 1, height: 44, paddingHorizontal: 8, paddingVertical: 0, includeFontPadding: false, textAlignVertical: 'center' },
  send: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
