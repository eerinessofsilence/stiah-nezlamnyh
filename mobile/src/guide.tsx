import { type NativeStackNavigationProp, useNavigation, useRouter, useScrollToTop, useSegments } from 'expo-router';
import { useIsFocused } from 'expo-router/react-navigation';
import { setStringAsync } from 'expo-clipboard';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo, Alert, Animated, Image, Keyboard, Linking, PanResponder, Platform, Pressable, ScrollView,
  type ScrollViewInstance, StyleSheet, Text, type TextInstance, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollViewMarker } from 'react-native-screens/experimental';

import type { GuideSection, Service } from './data/catalog';
import { guideIconSources, type GuideIconName } from './guide-icons';
import { GuideContentReady } from './guide-launch';
import { focusGuideControl, motion, useGuideTransition, useReducedMotion } from './guide-motion';
import { useGuideState } from './guide-state';
import { StatusEdge } from './status-edge';
import { useGuideAppearance, useGuideColors } from './theme';
import { typography } from './typography';

const tabRoutes = ['index', 'services', 'assistant', 'contacts', 'menu'];
const tabSwipeDirectionRatio = 1.4;
export const hasNativeHomeTabs = Platform.OS === 'ios' && Number.parseInt(Platform.Version, 10) >= 26;
export const guideContentMaxWidth = 448;
// Match the horizontal inset of the floating tab bar on iPhone.
export const guideContentInset = Platform.OS === 'ios' && !Platform.isPad && hasNativeHomeTabs ? 20 : 12;

export function GuideScreen({ title, titleAction, titleType = 'title', children, sheet = false, showBrand = false, scrollRef, adjustForKeyboard = false, footerHeight = 0, onScroll, onLayout, onScrollBeginDrag, onMomentumScrollEnd }: {
  title?: string;
  titleAction?: ReactNode;
  titleType?: 'title' | 'sheetTitle';
  children: ReactNode;
  sheet?: boolean;
  showBrand?: boolean;
  scrollRef?: Ref<ScrollViewInstance>;
  adjustForKeyboard?: boolean;
  footerHeight?: number;
} & Pick<ComponentProps<typeof ScrollView>, 'onScroll' | 'onLayout' | 'onScrollBeginDrag' | 'onMomentumScrollEnd'>) {
  const colors = useGuideColors();
  const { darkMode } = useGuideAppearance();
  const { offline } = useGuideState();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reportReady = useContext(GuideContentReady);
  const laidOut = useRef(false);
  const focused = useIsFocused();
  useEffect(() => {
    if (focused && laidOut.current) reportReady?.();
  }, [focused, reportReady]);
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const headingRef = useRef<TextInstance>(null);
  useLayoutEffect(() => {
    if (!sheet) return;
    return navigation.addListener('transitionEnd', ({ data }) => {
      if (!data.closing && navigation.isFocused()) focusGuideControl(headingRef.current);
    });
  }, [navigation, sheet]);
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
  const nativeEdgeEffects = hasNativeHomeTabs && !sheet;
  const tabScroll = useRef<ScrollViewInstance>(null);
  useScrollToTop(tabScroll);

  const scrollView = (
    <ScrollView
      onScroll={onScroll}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        laidOut.current = width > 0 && height > 0;
        if (laidOut.current && navigation.isFocused()) reportReady?.();
        onLayout?.(event);
      }}
      onScrollBeginDrag={onScrollBeginDrag}
      onMomentumScrollEnd={onMomentumScrollEnd}
      scrollEventThrottle={onScroll ? 16 : undefined}
      ref={scrollRef ?? (!nativeEdgeEffects && activeTab >= 0 && !sheet ? tabScroll : undefined)}
      style={{ flex: 1, backgroundColor: sheet ? colors.surface : colors.background }}
      contentInsetAdjustmentBehavior={sheet ? 'automatic' : nativeEdgeEffects ? 'always' : 'never'}
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
            <GuideText type="sheetTitle" textRef={headingRef} style={styles.titleText}>{title}</GuideText>
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
          {titleAction}
          <GuideText type={titleType} style={styles.titleText}>{title}</GuideText>
        </View>
      )}
      {offline && !sheet && activeTab >= 0 && <GuidePanel tone="surfaceSoft"><GuideText type="support" announcement>Ви офлайн. Довідник доступний, а для зовнішніх сайтів потрібен інтернет.</GuideText></GuidePanel>}
      {children}
    </ScrollView>
  );

  if (!nativeEdgeEffects && !sheet) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top,
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
        <StatusEdge pointerEvents="none" materialTint={colors.background}
          style={[styles.statusEdge, { height: insets.top + 16 }]} />
      )}
    </View>
  );
}

const serviceIcons: Record<string, GuideIconName> = {
  status: 'file-text',
  medical: 'first-aid-kit',
  rehab: 'person-simple-walk',
  legal: 'scales',
  benefits: 'money',
  work: 'briefcase',
  escort: 'users',
  housing: 'house',
  'fallen-family': 'heart',
  'pow-family': 'users',
  'missing-family': 'users',
  vlk: 'first-aid-kit',
  msek: 'clipboard-text',
  injury: 'bandaids',
  psychology: 'heartbeat',
};

export const icons = {
  arrow: 'arrow-right',
  next: 'caret-right',
  back: 'caret-left',
  phone: 'phone',
  external: 'arrow-square-out',
  close: 'x',
} as const satisfies Record<string, GuideIconName>;

export function GuideIcon({ name, color, size = 18 }: {
  name: GuideIconName; color?: string; size?: number;
}) {
  const colors = useGuideColors();
  return <Image source={guideIconSources[name]} fadeDuration={0} resizeMode="contain"
    style={{ width: size, height: size, tintColor: color ?? colors.accent }}
    accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

export function GuideStateIcon({ name, selectedName, selected, color, selectedColor = color, size = 18 }: {
  name: GuideIconName; selectedName: GuideIconName; selected: boolean; color: string; selectedColor?: string; size?: number;
}) {
  const progress = useGuideTransition(selected ? 1 : 0);
  return (
    <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
        <GuideIcon name={name} color={color} size={size} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <GuideIcon name={selectedName} color={selectedColor} size={size} />
      </Animated.View>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GuidePressable({ style, onFocus, onBlur, onPressIn, onPressOut, onTouchEnd, onTouchCancel, focusColor, pressedColor, ...props }:
  Omit<ComponentProps<typeof Pressable>, 'style' | 'android_ripple'> & {
    style?: ComponentProps<typeof View>['style']; focusColor?: string; pressedColor?: string;
  }) {
  const colors = useGuideColors();
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const pressing = useRef(false);
  const lastPressIn = useRef(0);
  const [highlight] = useState(() => new Animated.Value(0));
  const disabled = !!props.disabled;
  const baseColor = StyleSheet.flatten(style)?.backgroundColor;
  const tint = pressedColor ?? colors.surfaceMuted;
  const animatedColor = useMemo(() => highlight.interpolate({
    inputRange: [0, 1],
    outputRange: [typeof baseColor === 'string' && baseColor !== 'transparent' ? baseColor : `${tint}00`, tint],
  }), [baseColor, highlight, tint]);

  useEffect(() => {
    if (disabled) {
      pressing.current = false;
      setPressed(false);
    }
    highlight.setValue(pressing.current ? 1 : 0);
    return () => highlight.stopAnimation();
  }, [disabled, highlight, reduced]);

  // Touch end can arrive before Pressable's minimum press duration elapses.
  function releaseHighlight() {
    if (!pressing.current) return;
    pressing.current = false;
    setPressed(false);
    if (!reduced && !disabled) Animated.timing(highlight, {
      toValue: 0, duration: motion.feedback, easing: motion.easeOut, useNativeDriver: true, isInteraction: false,
    }).start();
  }

  return (
    <AnimatedPressable accessibilityLanguage="uk" {...props}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      onPressIn={event => {
        pressing.current = true;
        lastPressIn.current = event.timeStamp;
        setPressed(true);
        if (!reduced) highlight.setValue(1);
        onPressIn?.(event);
      }}
      onPressOut={event => {
        if (event.timeStamp >= lastPressIn.current) releaseHighlight();
        onPressOut?.(event);
      }}
      onTouchEnd={event => { releaseHighlight(); onTouchEnd?.(event); }}
      onTouchCancel={event => { releaseHighlight(); onTouchCancel?.(event); }}
      style={[
        style,
        !disabled && (props.onPress || props.onLongPress) &&
          { backgroundColor: reduced ? (pressed ? tint : baseColor) : animatedColor },
        focused && !disabled && { outlineWidth: 2, outlineOffset: -2, outlineColor: focusColor ?? colors.foreground },
      ]} />
  );
}

type ServiceListItem = Service | { service: Service; section: GuideSection };

function serviceListKey(item: ServiceListItem) {
  return 'section' in item ? `${item.service.id}:${item.section.id}` : item.id;
}

export function ServiceList({ items, tiles = false, subtitle, openSection, onOpen }: {
  items: ServiceListItem[]; tiles?: boolean;
  subtitle?: (service: Service) => string; openSection?: (service: Service) => string | null;
  onOpen?: (service: Service, section?: string) => void;
}) {
  const colors = useGuideColors();
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const twoColumns = width >= 340 && fontScale < 1.4;

  function serviceCard(item: ServiceListItem, last = false) {
    const { service, section } = 'section' in item ? item : { service: item, section: undefined };
    const title = section?.title ?? service.title;
    const description = section ? null : subtitle?.(service) ?? service.desc;
    return (
      <GuidePressable
        key={serviceListKey(item)}
        accessibilityRole="link"
        accessibilityLabel={tiles || !description ? title : `${title}. ${description}`}
        onPress={() => {
          Keyboard.dismiss();
          const sectionId = section?.id ?? openSection?.(service) ?? undefined;
          if (onOpen) onOpen(service, sectionId);
          else router.push({ pathname: '/service/[id]', params: { id: service.id, section: sectionId } });
        }}
        pressedColor={tiles ? colors.surface : colors.surfaceMuted}
        style={[
          tiles ? [styles.tile, twoColumns && styles.tileColumn, {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.borderStrong,
          }] : [styles.row, { backgroundColor: colors.surface },
            !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }],
        ]}
      >
        <View style={tiles ? styles.tileTop : undefined}>
          <View style={[styles.iconTile, { backgroundColor: tiles ? colors.surfaceSoft : colors.surfaceMuted }]}>
            <GuideIcon name={serviceIcons[service.id] ?? serviceIcons.status} size={22} />
          </View>
          {tiles && <GuideIcon name={icons.next} color={colors.foregroundMuted} size={22} />}
        </View>
        {tiles ? <GuideText type="tile">{title}</GuideText> : (
          <>
            <View style={styles.rowText}>
              <GuideText type="item">{title}</GuideText>
              {!!description && <GuideText type="support" tone="foregroundMuted">{description}</GuideText>}
            </View>
            <GuideIcon name={icons.next} color={colors.foregroundMuted} size={16} />
          </>
        )}
      </GuidePressable>
    );
  }

  if (tiles) {
    return (
      <View style={styles.grid}>
        {twoColumns ? items.map((item, i) => i % 2 === 0 && (
          <View key={serviceListKey(item)} style={styles.tilePair}>
            {serviceCard(item)}
            {items[i + 1] && serviceCard(items[i + 1])}
          </View>
        )) : items.map(item => serviceCard(item))}
      </View>
    );
  }
  return (
    <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
      {items.map((item, index) => serviceCard(item, index === items.length - 1))}
    </View>
  );
}

export type GuideTextTone = 'foreground' | 'foregroundMuted' | 'accent' | 'onFeature' | 'onHero';

export function GuideText({ children, type = 'body', heading = false, tone = 'foreground', announcement = false, style, textRef }: {
  children: ReactNode;
  type?: keyof typeof typography;
  heading?: boolean;
  tone?: GuideTextTone;
  announcement?: boolean;
  style?: ComponentProps<typeof Text>['style'];
  textRef?: Ref<TextInstance>;
}) {
  const colors = useGuideColors();
  const isHeading = heading || type === 'title' || type === 'sheetTitle' || type === 'section';
  return (
    <>
      {announcement && Platform.OS === 'ios' && typeof children === 'string' && <GuideAnnouncement message={children} />}
      <Text ref={textRef} accessibilityLanguage="uk" accessibilityRole={isHeading ? 'header' : undefined}
        accessibilityLiveRegion={announcement ? 'polite' : undefined}
        style={[typography[heading && type === 'body' ? 'section' : type], { color: colors[tone] }, style]}>
        {children}
      </Text>
    </>
  );
}

function GuideAnnouncement({ message }: { message: string }) {
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused || !message) return;
    const timeout = setTimeout(() => AccessibilityInfo.announceForAccessibility(message), 350);
    return () => clearTimeout(timeout);
  }, [focused, message]);
  return null;
}

export function GuidePanel({ children, tone = 'surface', style }: {
  children: ReactNode; tone?: 'surface' | 'surfaceSoft' | 'feature'; style?: ComponentProps<typeof View>['style'];
}) {
  const colors = useGuideColors();
  return <View style={[styles.panel, { backgroundColor: colors[tone], borderColor: tone === 'surface' ? colors.borderStrong : colors[tone] }, style]}>{children}</View>;
}

type ButtonAppearance = {
  label: string;
  variant?: 'primary' | 'secondary';
  icon?: GuideIconName;
  selectedIcon?: GuideIconName;
  tone?: 'foreground' | 'foregroundMuted' | 'accent' | 'onFeature';
  fullWidth?: boolean;
  row?: boolean;
};

export function GuideButton({ label, variant = 'secondary', icon, selectedIcon, tone = 'foreground', fullWidth = false, row = false, ...props }:
  ButtonAppearance & Pick<ComponentProps<typeof Pressable>,
  'onPress' | 'onLongPress' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityState' | 'disabled'>) {
  const colors = useGuideColors();
  const primary = variant === 'primary';
  const onFeature = !primary && tone === 'onFeature';
  const color = primary ? colors.onPrimaryButton : colors[tone];
  const leadingIcon = icon === icons.phone;

  return (
    <GuidePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      focusColor={color}
      {...props}
      pressedColor={primary ? colors.primaryButtonPressed : onFeature ? colors.featurePressed : colors.surfaceMuted}
      style={[
        styles.action, (row || fullWidth) && styles.fullWidth, row && styles.actionRow,
        {
          backgroundColor: primary ? colors.primaryButton : onFeature ? colors.feature : 'transparent',
          borderColor: colors.borderStrong,
          borderWidth: primary ? 0 : 1,
          opacity: props.disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon && leadingIcon && <GuideIcon name={icon} color={color} />}
      <Text style={[typography.item, styles.actionText, { color, textAlign: row ? 'left' : 'center' }]}>{label}</Text>
      {icon && !leadingIcon && (selectedIcon
        ? <GuideStateIcon name={icon} selectedName={selectedIcon} selected={!!props.accessibilityState?.selected} color={color} size={16} />
        : <GuideIcon name={icon} color={color} size={16} />)}
    </GuidePressable>
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

export function ExternalLink({ url, variant, ...appearance }: ButtonAppearance & { url: string; accessibilityLabel?: string }) {
  const colors = useGuideColors();
  const { offline } = useGuideState();
  const display = url.replace(/^(tel:|mailto:)/, '');
  const phoneOrEmail = display !== url;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  async function copy() {
    try {
      const copied = await setStringAsync(display);
      if (!copied) throw new Error('Clipboard unavailable');
      if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
        setCopied(true);
        clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 2000);
        AccessibilityInfo.announceForAccessibility('Скопійовано');
      }
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

  const linkProps = {
    accessibilityRole: 'link' as const,
    accessibilityLabel: appearance.accessibilityLabel ?? appearance.label,
    onPress: open,
    onLongPress: phoneOrEmail ? () => unavailable('Контактні дані') : undefined,
  };

  const tone = appearance.tone ?? 'accent';
  const featured = tone === 'onFeature';
  const link = variant ? <GuideButton {...appearance} variant={variant} {...linkProps} /> : (
    <GuidePressable {...linkProps} focusColor={featured ? colors.onFeature : undefined}
      pressedColor={featured ? colors.featurePressed : colors.surfaceMuted} style={[
      styles.textLink,
      appearance.fullWidth && styles.fullWidth,
      featured && { backgroundColor: colors.feature },
    ]}>
      <GuideText type="support" tone={tone} style={styles.actionText}>{appearance.label}</GuideText>
      {appearance.icon && <GuideIcon name={appearance.icon} color={colors[tone]} size={16} />}
    </GuidePressable>
  );
  return <View>
    {link}
    {copied && <GuideText type="support" tone={featured ? 'onFeature' : 'foregroundMuted'}>Скопійовано</GuideText>}
  </View>;
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
  list: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  tile: { padding: 16, gap: 8, justifyContent: 'space-between', minHeight: 116, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  tileColumn: { flex: 1 },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconTile: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { alignItems: 'center', flexDirection: 'row', gap: 11, minHeight: 80, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, gap: 4 },
  panel: { gap: 8, padding: 16, borderRadius: 18, borderWidth: 1 },
  action: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 26, flexDirection: 'row', gap: 8,
    alignItems: 'center', alignSelf: 'flex-start', justifyContent: 'center', overflow: 'hidden' },
  fullWidth: { alignSelf: 'stretch' },
  actionRow: { borderRadius: 14, justifyContent: 'space-between', paddingHorizontal: 16 },
  actionText: { flexShrink: 1 },
  textLink: { minWidth: 44, minHeight: 44, maxWidth: '100%', paddingHorizontal: 4,
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, borderRadius: 10 },
});
