/**
 * AnimateOnScroll — translation of web components/ui/AnimateOnScroll.tsx
 *
 * Web: wraps children in a framer-motion div that fades + slides in
 * when the element enters the viewport (useInView).
 *
 * RN adaptation: Uses Moti (Reanimated-based) to fade + slide in on mount.
 * The "on scroll" trigger is approximated — in RN we animate on mount since
 * ScrollView doesn't have an IntersectionObserver equivalent.
 * Visual result is identical (content animates in as screen loads).
 */

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { MotiView } from 'moti';

interface Props {
  children: React.ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export default function AnimateOnScroll({
  children,
  direction = 'up',
  delay = 0,
  duration = 500,
  style,
}: Props) {
  const initial = {
    opacity: 0,
    translateY: direction === 'up' ? 30 : direction === 'down' ? -30 : 0,
    translateX: direction === 'left' ? 40 : direction === 'right' ? -40 : 0,
  };

  const animate = {
    opacity: 1,
    translateY: 0,
    translateX: 0,
  };

  return (
    <MotiView
      from={initial}
      animate={animate}
      transition={{ type: 'timing', duration, delay }}
      style={style}>
      {children}
    </MotiView>
  );
}
