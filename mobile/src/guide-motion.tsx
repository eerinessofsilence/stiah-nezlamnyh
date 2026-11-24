import { createContext, type ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type HostInstance } from 'react-native';

export const motion = {
  feedback: 120,
  appear: 160,
  collapse: 220,
  expand: 300,
  logoFadeIn: 750,
  logoHold: 2000,
  logoFadeOut: 250,
  easeOut: Easing.bezier(0, 0, 0.58, 1),
  easeInOut: Easing.bezier(0.42, 0, 0.58, 1),
};

const ReduceMotion = createContext<boolean | null>(null);

export function GuideMotionProvider({ children }: { children: ReactNode }) {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    let current = true;
    let receivedChange = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      receivedChange = true;
      setReduced(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (current && !receivedChange) setReduced(enabled);
    }, () => {});
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);

  return <ReduceMotion.Provider value={reduced}>{children}</ReduceMotion.Provider>;
}

export function useMotionPreference() {
  return useContext(ReduceMotion);
}

export function useReducedMotion() {
  return useMotionPreference() !== false;
}

export function useGuideTransition(target: number) {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(target));
  const previous = useRef(target);

  useLayoutEffect(() => {
    const changed = previous.current !== target;
    previous.current = target;
    if (reduced || !changed) {
      value.setValue(target);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: target, duration: motion.feedback, easing: motion.easeOut, useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [reduced, target, value]);

  return value;
}

export function focusGuideControl(control: HostInstance | null) {
  if (!control) return;
  control.focus();
  AccessibilityInfo.sendAccessibilityEvent(control, 'focus');
}
