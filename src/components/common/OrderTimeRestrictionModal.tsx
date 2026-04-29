/**
 * OrderTimeRestrictionModal — direct port of the web `showOrderTimeModal`
 * dialog rendered from `pages/CartPage.tsx` (lines ~1691-1762).
 *
 * Web parity points:
 *   • Gradient header: #054A86 → indigo-700, with a Clock icon, title
 *     "Ordering Hours", subtitle "Plan orders have a daily window".
 *   • Body shows the allowed window (7:00 AM – 6:00 PM) with the "UAE Time
 *     (UTC+4)" caption underneath.
 *   • The user's *current* UAE time, computed live the same way the web
 *     does it (`getTimezoneOffset() + 4*60`).
 *   • Note that "Order Now items are available at any time."
 *   • Single dismiss button: "Got it, I'll come back later".
 *
 * Used by CartScreen — shown when a user with WEEKLY / MONTHLY / SWEETS
 * cart items hits the Proceed-to-checkout flow outside 07:00–18:00 UAE.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock } from 'lucide-react-native';
import { Colors } from '@/utils/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Same calculation the web uses on CartPage.tsx — Asia/Dubai is fixed UTC+4
// year-round, so a hardcoded offset is correct.
const formatCurrentUaeTime = () =>
  new Date(
    new Date().getTime() +
      (new Date().getTimezoneOffset() + 4 * 60) * 60_000,
  ).toLocaleTimeString('en-AE', {
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true,
  });

export default function OrderTimeRestrictionModal({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              {/* Gradient header */}
              <LinearGradient
                colors={['#054A86', '#4338CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}>
                <View style={styles.iconCircle}>
                  <Clock size={28} color={Colors.neutralWhite} />
                </View>
                <Text style={styles.title}>Ordering Hours</Text>
                <Text style={styles.subtitle}>
                  Plan orders have a daily window
                </Text>
              </LinearGradient>

              {/* Body */}
              <View style={styles.body}>
                {/* Window display card */}
                <View style={styles.windowCard}>
                  <Text style={styles.windowTime}>7:00 AM – 6:00 PM</Text>
                  <Text style={styles.windowZone}>UAE Time (UTC+4)</Text>
                </View>

                <Text style={styles.message}>
                  Weekly, Monthly & Sweets orders can only be placed between
                  7:00 AM and 6:00 PM UAE time.
                </Text>

                <View style={styles.currentTimeRow}>
                  <Text style={styles.currentTimeLabel}>
                    Your current UAE time:
                  </Text>
                  <Text style={styles.currentTimeValue}>
                    {formatCurrentUaeTime()}
                  </Text>
                </View>

                <Text style={styles.note}>
                  Order Now items are available at any time.
                </Text>

                <TouchableOpacity style={styles.cta} onPress={onClose}>
                  <Text style={styles.ctaText}>
                    Got it, I'll come back later
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },

  // Gradient header
  header: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title:    { fontSize: 22, fontWeight: '800', color: Colors.neutralWhite },
  subtitle: { fontSize: 13, color: Colors.neutralWhite, opacity: 0.85, marginTop: 4 },

  // Body
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 22 },

  windowCard: {
    backgroundColor: '#F3F4F6',                     // slate-100
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  windowTime: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  windowZone: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',                                // gray-400
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
  },

  message: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.neutralGrayDark,
    textAlign: 'center',
  },

  currentTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
  },
  currentTimeLabel: { fontSize: 13, color: Colors.neutralGrayDark, fontWeight: '600' },
  currentTimeValue: { fontSize: 14, color: Colors.neutralBlack, fontWeight: '800' },

  note: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 14,
    fontStyle: 'italic',
  },

  cta: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.neutralWhite,
  },
});
