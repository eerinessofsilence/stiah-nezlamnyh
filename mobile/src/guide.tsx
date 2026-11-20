import { useRouter, useSegments } from 'expo-router';
import { setStringAsync } from 'expo-clipboard';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, type ComponentProps, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo, Alert, Image, Keyboard, Linking, PanResponder, Platform, Pressable, ScrollView,
  type ScrollViewInstance, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollViewMarker } from 'react-native-screens/experimental';

import type { Service } from './data/catalog';
import { useGuideState } from './guide-state';
import { StatusEdge } from './status-edge';
import { useGuideAppearance, useGuideColors } from './theme';
import { typography } from './typography';

const tabRoutes = ['index', 'services', 'assistant', 'contacts', 'menu'];
const tabSwipeDirectionRatio = 1.4;
const hasNativeEdgeEffects = Platform.OS === 'ios' && Number.parseInt(Platform.Version, 10) >= 26;
export const guideContentMaxWidth = 448;
// Match the horizontal inset of the floating tab bar on iPhone.
export const guideContentInset = Platform.OS === 'ios' && !Platform.isPad && hasNativeEdgeEffects ? 20 : 12;

export function GuideScreen({ title, titleAction, titleType = 'title', children, sheet = false, showBrand = false, scrollRef, adjustForKeyboard = false, footerHeight = 0 }: {
  title?: string;
  titleAction?: ReactNode;
  titleType?: 'title' | 'sheetTitle';
  children: ReactNode;
  sheet?: boolean;
  showBrand?: boolean;
  scrollRef?: Ref<ScrollViewInstance>;
  adjustForKeyboard?: boolean;
  footerHeight?: number;
}) {
  const colors = useGuideColors();
  const { darkMode } = useGuideAppearance();
  const { offline } = useGuideState();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const routeTab = tabRoutes.findIndex((route) => segments.at(-1) === route);
  const activeTab = routeTab >= 0 ? routeTab : segments.includes('(tabs)') ? 0 : -1;
  const tabSwipe = useMemo(() => {
    let verticalDrag = false;
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        verticalDrag = false;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => {
        const horizontal = Math.abs(dx);
        const vertical = Math.abs(dy);
        verticalDrag ||= vertical > 12 && vertical >= horizontal;
        return !verticalDrag && horizontal > 32 && horizontal > vertical * tabSwipeDirectionRatio;
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        const nextTab = activeTab + (dx < 0 ? 1 : -1);
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * tabSwipeDirectionRatio &&
          nextTab >= 0 && nextTab < tabRoutes.length) {
          router.navigate(`/(tabs)/${tabRoutes[nextTab]}` as never);
        }
      },
    });
  }, [activeTab, router]);
  const android = Platform.OS === 'android';
  const nativeEdgeEffects = hasNativeEdgeEffects && !sheet;

  const scrollView = (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: sheet ? colors.surface : colors.canvas }}
      contentInsetAdjustmentBehavior={sheet ? 'automatic' : 'always'}
      automaticallyAdjustKeyboardInsets={adjustForKeyboard}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={android ? 'on-drag' : 'interactive'}
      stickyHeaderIndices={sheet && title ? [0] : undefined}
      contentContainerStyle={[
        styles.screen,
        sheet && styles.sheet,
        footerHeight > 0 && { paddingBottom: 16 + footerHeight },
        android && sheet && {
          paddingTop: 24,
          paddingBottom: 16 + insets.bottom,
          paddingLeft: 12 + insets.left,
          paddingRight: 12 + insets.right,
        },
      ]}
    >
      {sheet && title && (
        <View style={[styles.sheetTitleRow, { backgroundColor: colors.surface }]}>
          <View style={styles.titleRow}>
            <GuideText type="sheetTitle" style={styles.titleText}>{title}</GuideText>
            {titleAction}
          </View>
        </View>
      )}
      {!sheet && showBrand && (
        <View style={styles.brand}>
          <Image source={darkMode ? require('../assets/brand-logo-dark.png') : require('../assets/brand-logo.png')}
            style={styles.brandLogo} accessibilityLabel="Гід: Стяг незламних" />
        </View>
      )}
      {!sheet && title && (
        <View style={styles.titleRow}>
          <GuideText type={titleType} style={styles.titleText}>{title}</GuideText>
          {titleAction}
        </View>
      )}
      {offline && !sheet && activeTab >= 0 && <GuidePanel tone="soft"><GuideText type="support" announcement>Ви офлайн. Довідник доступний, а для зовнішніх сайтів потрібен інтернет.</GuideText></GuidePanel>}
      {children}
    </ScrollView>
  );

  if (android && !sheet) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top,
        paddingLeft: insets.left, paddingRight: insets.right }}>
        {scrollView}
      </View>
    );
  }

  // ScrollView overrides the responder callback that resets gesture state on touch start.
  return (
    <View {...(Platform.OS === 'ios' && !sheet && activeTab >= 0 ? tabSwipe.panHandlers : undefined)}
      style={{ flex: 1 }}>
      {nativeEdgeEffects ? (
        <ScrollViewMarker style={styles.edgeScroll} scrollEdgeEffects={{ top: 'hidden', bottom: 'soft' }}>
          {scrollView}
        </ScrollViewMarker>
      ) : scrollView}
      {StatusEdge && !sheet && insets.top > 0 && (
        <StatusEdge pointerEvents="none" materialTint={colors.canvas}
          style={[styles.statusEdge, { height: insets.top + 16 }]} />
      )}
    </View>
  );
}

const serviceIcons: Record<string, SymbolViewProps['name']> = {
  status: { ios: 'doc.text', android: 'description' },
  medical: { ios: 'cross.case', android: 'medical_services' },
  rehab: { ios: 'figure.walk', android: 'accessibility_new' },
  legal: { ios: 'scalemass', android: 'balance' },
  benefits: { ios: 'banknote', android: 'account_balance_wallet' },
  work: { ios: 'briefcase', android: 'work' },
  escort: { ios: 'person.2', android: 'group' },
  housing: { ios: 'house', android: 'home' },
  'fallen-family': { ios: 'heart', android: 'favorite' },
  'missing-family': { ios: 'person.2', android: 'group' },
  vlk: { ios: 'cross.case', android: 'medical_services' },
  msek: { ios: 'list.clipboard', android: 'assignment' },
  injury: { ios: 'bandage', android: 'healing' },
  psychology: { ios: 'heart.text.square', android: 'psychology' },
};

export const icons = {
  arrow: { ios: 'arrow.right', android: 'arrow_forward' },
  next: { ios: 'chevron.right', android: 'chevron_right' },
  phone: { ios: 'phone', android: 'call' },
  external: { ios: 'arrow.up.right.square', android: 'open_in_new' },
  close: { ios: 'xmark', android: 'close' },
} satisfies Record<string, SymbolViewProps['name']>;

export function GuideIcon({ name, color, size = 18 }: {
  name: SymbolViewProps['name']; color?: string; size?: number;
}) {
  const colors = useGuideColors();
  return <SymbolView name={name} size={size} tintColor={color ?? colors.accent}
    accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

export function ServiceList({ items, tiles = false, subtitle, openSection }: {
  items: Service[]; tiles?: boolean; subtitle?: (service: Service) => string; openSection?: (service: Service) => string | null;
}) {
  const colors = useGuideColors();
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const grid = tiles && width >= 340 && fontScale < 1.4;

  function serviceCard(service: Service, last = false) {
    const description = subtitle?.(service) ?? service.desc;
    return (
      <Pressable
        key={service.id}
        accessibilityRole="link"
        accessibilityLabel={grid ? service.title : `${service.title}. ${description}`}
        onPress={() => {
          Keyboard.dismiss();
          const section = openSection?.(service);
          router.push({ pathname: '/service/[id]', params: section ? { id: service.id, section } : { id: service.id } });
        }}
        android_ripple={{ color: colors.line }}
        style={({ pressed }) => [
          grid ? styles.tile : styles.row,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
          !grid && !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
        ]}
      >
        <View style={grid ? styles.tileTop : undefined}>
          <View style={[styles.iconTile, { backgroundColor: colors.surfaceMuted }]}>
            <GuideIcon name={serviceIcons[service.id] ?? serviceIcons.status} size={22} />
          </View>
          {grid && <GuideIcon name={icons.next} color={colors.muted} size={22} />}
        </View>
        {grid ? <GuideText type="tile">{service.title}</GuideText> : (
          <>
            <View style={styles.rowText}>
              <GuideText type="item">{service.title}</GuideText>
              <GuideText type="support" tone="muted">{description}</GuideText>
            </View>
            <GuideIcon name={icons.next} color={colors.muted} size={16} />
          </>
        )}
      </Pressable>
    );
  }

  if (grid) {
    return (
      <View style={styles.grid}>
        {items.map((service, i) => i % 2 === 0 && (
          <View key={service.id} style={styles.tilePair}>
            {serviceCard(service)}
            {items[i + 1] ? serviceCard(items[i + 1]) : <View style={{ flex: 1 }} />}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {items.map((service, index) => serviceCard(service, index === items.length - 1))}
    </View>
  );
}

export function GuideText({ children, type = 'body', heading = false, tone = 'ink', announcement = false, style }: {
  children: ReactNode;
  type?: keyof typeof typography;
  heading?: boolean;
  tone?: 'ink' | 'muted' | 'onFeature';
  announcement?: boolean;
  style?: ComponentProps<typeof Text>['style'];
}) {
  const colors = useGuideColors();
  return (
    <Text accessibilityRole={heading || type === 'title' || type === 'sheetTitle' || type === 'section' ? 'header' : undefined}
      accessibilityLiveRegion={announcement ? 'polite' : undefined}
      style={[typography[heading && type === 'body' ? 'section' : type], { color: colors[tone] }, style]}>
      {children}
    </Text>
  );
}

export function GuidePanel({ children, tone = 'surface', style }: {
  children: ReactNode; tone?: 'surface' | 'soft' | 'feature'; style?: ComponentProps<typeof View>['style'];
}) {
  const colors = useGuideColors();
  return <View style={[styles.panel, { backgroundColor: colors[tone], borderColor: tone === 'surface' ? colors.line : colors[tone] }, style]}>{children}</View>;
}

type ButtonAppearance = {
  label: string;
  variant?: 'primary' | 'secondary' | 'link';
  icon?: SymbolViewProps['name'];
  tone?: 'ink' | 'muted' | 'onFeature';
  fullWidth?: boolean;
  row?: boolean;
};

export function GuideButton({ label, variant = 'secondary', icon, tone = 'ink', fullWidth = false, row = false, ...props }:
  ButtonAppearance & Pick<ComponentProps<typeof Pressable>,
  'onPress' | 'onLongPress' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityState' | 'disabled'>) {
  const colors = useGuideColors();
  const link = variant === 'link';
  const primary = variant === 'primary';
  const color = primary ? colors.onPrimaryButton : link ? colors.accent : colors[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
      android_ripple={{ color: colors.line }}
      style={({ pressed }) => [
        styles.action, (row || fullWidth) && styles.fullWidth, row && styles.actionRow, link && styles.actionLink,
        {
          backgroundColor: primary ? colors.primaryButton : 'transparent',
          borderColor: colors.lineStrong,
          borderWidth: variant === 'secondary' ? 1 : 0,
          opacity: props.disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon && icon === icons.phone && <GuideIcon name={icon} color={color} />}
        <Text style={[
        row || link ? typography.support : typography.item,
        styles.actionText,
        { color, textAlign: row || link ? 'left' : 'center' },
      ]}>{label}</Text>
      {icon && icon !== icons.phone && <GuideIcon name={icon} color={color} size={16} />}
      {link && !icon && <GuideIcon name={icons.external} color={color} size={16} />}
    </Pressable>
  );
}

export function RouteLink({ id, section }: { id: string; section?: string }) {
  const router = useRouter();
  return <GuideButton label="Повний маршрут" accessibilityRole="link" variant="primary" fullWidth icon={icons.arrow}
    onPress={() => {
      Keyboard.dismiss();
      router.push({ pathname: '/service/[id]', params: section ? { id, section } : { id } });
    }} />;
}

export function ExternalLink({ url, ...appearance }: ButtonAppearance & { url: string; accessibilityLabel?: string }) {
  const { offline } = useGuideState();
  const display = url.replace(/^(tel:|mailto:)/, '');
  const phoneOrEmail = display !== url;

  async function copy() {
    try {
      const copied = await setStringAsync(display);
      if (!copied) throw new Error('Clipboard unavailable');
      AccessibilityInfo.announceForAccessibility('Скопійовано');
    } catch {
      Alert.alert('Не вдалося скопіювати', display);
    }
  }

  function unavailable(message: string) {
    Alert.alert(message, display, [
      { text: 'Закрити', style: 'cancel' },
      { text: 'Скопіювати', onPress: copy },
    ]);
  }

  async function open() {
    if (offline && !phoneOrEmail) {
      unavailable('Для відкриття сайту потрібен інтернет');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      unavailable('Не вдалося відкрити посилання');
    }
  }

  return (
    <GuideButton
      variant="link"
      {...appearance}
      accessibilityRole="link"
      onPress={open}
      onLongPress={phoneOrEmail ? () => unavailable('Контактні дані') : undefined}
    />
  );
}

const styles = StyleSheet.create({
  screen: { gap: 12, paddingHorizontal: guideContentInset, paddingTop: 12, paddingBottom: 16, width: '100%', maxWidth: guideContentMaxWidth, alignSelf: 'center' },
  edgeScroll: { flex: 1 },
  statusEdge: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1 },
  sheet: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTitleRow: { paddingVertical: 8 },
  titleText: { flex: 1 },
  brand: { minHeight: 56, alignItems: 'flex-start', justifyContent: 'center' },
  brandLogo: { width: 227, height: 56, maxWidth: '100%', resizeMode: 'contain' },
  grid: { gap: 8 },
  tilePair: { flexDirection: 'row', gap: 8 },
  list: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tile: { flex: 1, padding: 16, gap: 8, justifyContent: 'space-between', minHeight: 116, borderRadius: 16, overflow: 'hidden' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconTile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 11, minHeight: 80, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, gap: 4 },
  panel: { gap: 8, padding: 16, borderRadius: 16, borderWidth: 1 },
  action: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, flexDirection: 'row', gap: 8,
    alignItems: 'center', alignSelf: 'flex-start', justifyContent: 'center', overflow: 'hidden' },
  fullWidth: { alignSelf: 'stretch' },
  actionRow: { borderRadius: 12, justifyContent: 'space-between', paddingHorizontal: 12 },
  actionLink: { minHeight: 44, paddingHorizontal: 0, justifyContent: 'flex-start', borderRadius: 8 },
  actionText: { flexShrink: 1 },
});
