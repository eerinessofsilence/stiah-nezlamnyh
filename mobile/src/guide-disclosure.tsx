import { type ComponentProps, type ReactNode, useLayoutEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { GuideButton, GuidePanel } from './guide';
import { motion, useReducedMotion } from './guide-motion';
import { useGuideColors } from './theme';

export function GuideDisclosure({ label, tone, initiallyOpen = false, children }: {
  label: string; tone?: ComponentProps<typeof GuideButton>['tone']; initiallyOpen?: boolean; children: ReactNode;
}) {
  const colors = useGuideColors();
  const [open, setOpen] = useState(initiallyOpen);
  const [firstOpen, setFirstOpen] = useState(initiallyOpen);
  const [retained, setRetained] = useState(initiallyOpen);
  const [height, setHeight] = useState<number | null>(null);
  const [progress] = useState(() => new Animated.Value(initiallyOpen ? 1 : 0));
  const reduced = useReducedMotion();
  const measured = height !== null;

  useLayoutEffect(() => {
    if (open) setRetained(true);
    if (reduced) {
      progress.setValue(open ? 1 : 0);
      if (!open) {
        setRetained(false);
        setHeight(null);
      }
      return;
    }
    if (!measured) {
      progress.setValue(open && firstOpen ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0, duration: open ? motion.expand : motion.collapse,
      easing: motion.easeInOut, useNativeDriver: false, isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished && !open) {
        setRetained(false);
        setHeight(null);
      }
    });
    return () => animation.stop();
  }, [firstOpen, measured, open, progress, reduced]);

  return (
    <GuidePanel style={[styles.card, { backgroundColor: colors.background }]}>
      <GuideButton label={label} tone={tone} row style={styles.trigger} accessibilityState={{ expanded: open }}
        icon={open ? 'caret-up' : 'caret-down'} onPress={() => {
          setFirstOpen(false);
          setOpen(current => !current);
        }} />
      {(open || retained) && (
        <Animated.View pointerEvents={open ? 'auto' : 'none'}
          accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          style={[styles.clip, { backgroundColor: colors.surface }, !reduced && {
            height: measured ? Animated.multiply(progress, height) : firstOpen ? undefined : 0,
          }]}>
          <Animated.View onLayout={event => setHeight(event.nativeEvent.layout.height)}
            style={[styles.content, !reduced && (measured || !firstOpen) && styles.measure, !reduced && { opacity: progress }]}>
            {children}
          </Animated.View>
          <View pointerEvents="none" style={[styles.divider, { backgroundColor: colors.borderStrong }]} />
        </Animated.View>
      )}
    </GuidePanel>
  );
}

const verticalPadding = 16;

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0, borderRadius: 14, overflow: 'hidden' },
  trigger: { borderWidth: 0, borderRadius: 0, paddingVertical: verticalPadding },
  clip: { overflow: 'hidden' },
  content: { paddingHorizontal: 16, paddingVertical: verticalPadding, gap: 8 },
  measure: { position: 'absolute', top: 0, left: 0, right: 0 },
  divider: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, opacity: 0.75 },
});
