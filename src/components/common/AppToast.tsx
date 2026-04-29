/**
 * AppToast — custom in-app toast that replaces react-native-toast-message.
 *
 * The library's auto-hide misbehaves on this RN/Expo build (toasts stick
 * even when `visibilityTime`, `autoHide`, manual `setTimeout(Toast.hide)`,
 * and useFocusEffect cleanups are all in place). Rolling our own gives us
 * full control: a single state-driven banner with a guaranteed dismiss.
 *
 * Usage:
 *   import { showAppToast } from '@/components/common/AppToast';
 *   showAppToast({ type: 'success', text1: 'Profile updated!' });
 *
 * Mount once at the app root:
 *   <AppToastHost />
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/utils/colors';

type ToastType = 'success' | 'error' | 'info';
interface ToastConfig {
  type: ToastType;
  text1: string;
  text2?: string;
  duration?: number;          // ms, default 3000
}

// Tiny event bus — host subscribes, callers dispatch via showAppToast.
type Listener = (cfg: ToastConfig | null) => void;
const listeners = new Set<Listener>();

export const showAppToast = (cfg: ToastConfig) => {
  listeners.forEach(fn => fn(cfg));
};

export const hideAppToast = () => {
  listeners.forEach(fn => fn(null));
};

const { width: SCREEN_W } = Dimensions.get('window');

export const AppToastHost = () => {
  const insets = useSafeAreaInsets();
  const [cfg, setCfg] = useState<ToastConfig | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler: Listener = (next) => {
      // Cancel any pending dismiss before applying the new state.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setCfg(next);
      if (next) {
        const ms = next.duration ?? 3000;
        timerRef.current = setTimeout(() => {
          setCfg(null);
          timerRef.current = null;
        }, ms);
      }
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!cfg) return null;

  const Icon = cfg.type === 'success' ? CheckCircle2 : cfg.type === 'error' ? AlertCircle : Info;
  const accent =
    cfg.type === 'success' ? '#22C55E' :
    cfg.type === 'error'   ? '#EF4444' :
    Colors.primary;

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: -20 }}
      transition={{ type: 'timing', duration: 220 }}
      style={[
        styles.container,
        { top: insets.top + 8, borderLeftColor: accent },
      ]}
      pointerEvents="none">
      <Icon size={20} color={accent} />
      <Text style={styles.text1} numberOfLines={2}>{cfg.text1}</Text>
      {cfg.text2 ? <Text style={styles.text2} numberOfLines={2}>{cfg.text2}</Text> : null}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 56,
    width: SCREEN_W - 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    backgroundColor: Colors.neutralWhite,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 12,
    zIndex: 9999,
  },
  text1: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.neutralBlack },
  text2: { fontSize: 12, color: Colors.neutralGrayDark, marginTop: 2 },
});
