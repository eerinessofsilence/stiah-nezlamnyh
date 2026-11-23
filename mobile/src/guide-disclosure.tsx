import { type ComponentProps, type ReactNode, useLayoutEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { GuideButton } from './guide';
import { motion, useReducedMotion } from './guide-motion';

export function GuideDisclosure({ label, tone, initiallyOpen = false, children }: {
  label: string; tone?: ComponentProps<typeof GuideButton>['tone']; initiallyOpen?: boolean; children: ReactNode;
}) {
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
    <View>
      <GuideButton label={label} tone={tone} row accessibilityState={{ expanded: open }}
        icon={open ? 'caret-up' : 'caret-down'} onPress={() => {
          setFirstOpen(false);
          setOpen(current => !current);
        }} />
      {(open || retained) && (
        <Animated.View pointerEvents={open ? 'auto' : 'none'}
          accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          style={!reduced && [styles.clip, { height: measured ? Animated.multiply(progress, height) : firstOpen ? undefined : 0 }]}>
          <View onLayout={event => setHeight(event.nativeEvent.layout.height)}
            style={[styles.content, !reduced && (measured || !firstOpen) && styles.measure]}>
            {children}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  content: { paddingTop: 4, gap: 4 },
  measure: { position: 'absolute', top: 0, left: 0, right: 0 },
});
