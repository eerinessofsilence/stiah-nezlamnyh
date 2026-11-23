import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { checkedOn, type GuideSection, preparation, services } from '../../data/catalog';
import { GuideButton, GuideIcon, GuidePanel, GuidePressable, GuideScreen, GuideText, icons, ServiceList } from '../../guide';
import { GuideDisclosure } from '../../guide-disclosure';
import { useGuideState } from '../../guide-state';
import { BookmarkButton, ProgressUnavailable, RouteAction, RouteChecklist, RouteSources } from '../../route-actions';
import { useGuideColors } from '../../theme';

export default function ServiceScreen() {
  const router = useRouter();
  const colors = useGuideColors();
  const { id, section, returnTo, view } = useLocalSearchParams<{
    id: string; section?: string; returnTo?: string; view?: string;
  }>();
  const { progress } = useGuideState();
  const service = services.find(item => item.id === id);
  const close = (
    <GuidePressable accessibilityRole="button" accessibilityLabel="Повернутися до послуг"
      onPress={() => returnTo === '/services-modal' ? router.replace('/services-modal') : router.canGoBack() ? router.back() : router.replace('/services')}
      pressedColor={colors.surface} style={[styles.close, { backgroundColor: colors.surfaceSoft }]}>
      <GuideIcon name={icons.back} size={18} />
    </GuidePressable>
  );

  if (!service) {
    return (
      <GuideScreen title="Маршрут не знайдено" titleAction={close}>
        <GuideButton label="Перейти до послуг" accessibilityRole="link" onPress={() => router.dismissTo('/services')} />
      </GuideScreen>
    );
  }

  const checklist = preparation[id];
  const active = service.sections.find(part => part.id === section);
  const lists = Object.entries(preparation).filter(([key]) => key === id || key.startsWith(id + ':'));
  const references = [...new Set([...service.source, ...lists.flatMap(([, list]) => list ? [list.source] : [])])];
  const checklistFor = (part: GuideSection) => lists.find(([, list]) => list?.section === part.id)?.[0];

  if (view === 'topic' && active) {
    return (
      <GuideScreen title={active.title} titleAction={close}>
        <SectionContent section={active} checklistFor={checklistFor(active)} />
        {progress ? <BookmarkButton id={id} /> : <ProgressUnavailable />}
        <RouteSources key={service.id} sourceKeys={references} />
        <GuideText type="meta" tone="foregroundMuted">Редакція від {checkedOn}</GuideText>
      </GuideScreen>
    );
  }

  return (
    <GuideScreen title={service.title} titleAction={close}>
      <GuideText type="support" tone="foregroundMuted">{service.desc}</GuideText>
      {active && <SectionCard key={id + active.id} section={active} checklistFor={checklistFor(active)} initiallyOpen />}
      <RouteAction action={service.action} primary />
      {progress ? <BookmarkButton id={id} /> : <ProgressUnavailable />}
      <GuidePanel tone="surfaceSoft">
        <GuideText heading>З чого почати</GuideText>
        {service.steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <View style={[styles.number, { backgroundColor: colors.surface }]}>
              <GuideText type="number">{index + 1}</GuideText>
            </View>
            <GuideText style={styles.stepCopy}>{step}</GuideText>
          </View>
        ))}
      </GuidePanel>
      {checklist && !checklist.section && <RouteChecklist id={id} />}
      <GuideText heading>{active ? 'Інші питання за темою' : 'Оберіть свою ситуацію'}</GuideText>
      {service.sections.filter(part => part !== active).map(part => (
        <SectionCard key={id + part.id} section={part} checklistFor={checklistFor(part)} />
      ))}
      <GuideText heading>Пов’язані маршрути</GuideText>
      <ServiceList items={service.related.flatMap(relatedId => services.filter(item => item.id === relatedId))} />
      <RouteSources key={service.id} sourceKeys={references} />
      <GuideText type="meta" tone="foregroundMuted">Редакція від {checkedOn}</GuideText>
    </GuideScreen>
  );
}

function SectionCard({ section, checklistFor, initiallyOpen = false }: {
  section: GuideSection; checklistFor?: string; initiallyOpen?: boolean;
}) {
  return (
    <GuideDisclosure label={section.title} initiallyOpen={initiallyOpen}>
      <SectionContent section={section} checklistFor={checklistFor} />
    </GuideDisclosure>
  );
}

function SectionContent({ section, checklistFor }: { section: GuideSection; checklistFor?: string }) {
  return (
    <GuidePanel>
      {section.paragraphs.map(paragraph => <GuideText key={paragraph}>{paragraph}</GuideText>)}
      <RouteAction action={section.action} />
      {checklistFor && <RouteChecklist id={checklistFor} />}
    </GuidePanel>
  );
}

const styles = StyleSheet.create({
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  number: { minWidth: 28, minHeight: 28, padding: 4, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepCopy: { flex: 1 },
});
