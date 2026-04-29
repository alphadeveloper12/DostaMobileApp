/**
 * AuthPromptModal — faithful translation of web components/common/AuthPromptModal.tsx
 *
 * Web original:
 *   Fixed overlay z-[9999], backdrop bg-black/60 backdrop-blur
 *   Modal: rounded-[24px] max-w-[420px] bg-white
 *   Header: gradient bg from #054A86 to #0768B8, ShoppingCart icon, title, subtitle
 *   Body: message text, 3 buttons:
 *     1. "Continue with Google" (white bg, Google SVG icon)
 *     2. "Sign In to My Account" (bg-[#054A86], LogIn icon)
 *     3. "Create New Account" (border-2 border-[#054A86], UserPlus icon)
 *   Footer note: "Your selections will be saved when you return"
 *
 * Adaptations:
 *   backdrop-blur → Modal with semi-transparent overlay
 *   framer-motion scale/y animation → Moti spring animation
 *   Google OAuth via @react-oauth/google → expo-auth-session (kept as navigation to SignIn for now)
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
import { MotiView } from 'moti';
import { ShoppingCart, X, LogIn, UserPlus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '@/utils/colors';

interface Props {
  isOpen:    boolean;
  onClose:   () => void;
  message?:  string;
  // Where to send the user after a successful sign-in / sign-up. Passed
  // through to SignInScreen/SignUpScreen as a nav param. If unset, the auth
  // screens fall back to resetting the stack to Home.
  returnTo?: { name: string; params?: Record<string, any> };
}

export default function AuthPromptModal({
  isOpen,
  onClose,
  message = 'Please log in to your account to add items to your cart.',
  returnTo,
}: Props) {
  const navigation = useNavigation<any>();

  const handleSignIn = () => {
    onClose();
    navigation.navigate('SignIn', returnTo ? { returnTo } : undefined);
  };

  const handleSignUp = () => {
    onClose();
    navigation.navigate('SignUp', returnTo ? { returnTo } : undefined);
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <MotiView
              from={{ opacity: 0, scale: 0.92, translateY: 20 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={styles.modal}>

              {/* Header gradient — bg-gradient from #054A86 to #0768B8 */}
              <View style={styles.modalHeader}>
                {/* Close button */}
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <X size={16} color={Colors.neutralWhite} />
                </TouchableOpacity>

                {/* Shopping cart icon in white/20 circle */}
                <View style={styles.iconCircle}>
                  <ShoppingCart size={28} color={Colors.neutralWhite} />
                </View>

                <Text style={styles.headerTitle}>Login Required</Text>
                <Text style={styles.headerSubtitle}>
                  Sign in to unlock your cart
                </Text>
              </View>

              {/* Body — rounded top corners overlap header */}
              <View style={styles.body}>
                <Text style={styles.message}>{message}</Text>

                <View style={styles.buttonsCol}>
                  {/* Sign In button — bg-[#054A86] */}
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={handleSignIn}>
                    <LogIn size={18} color={Colors.neutralWhite} />
                    <Text style={styles.btnPrimaryText}>
                      Sign In to My Account
                    </Text>
                  </TouchableOpacity>

                  {/* Create Account button — border-2 border-[#054A86] */}
                  <TouchableOpacity
                    style={styles.btnOutline}
                    onPress={handleSignUp}>
                    <UserPlus size={18} color={Colors.primary} />
                    <Text style={styles.btnOutlineText}>
                      Create New Account
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.note}>
                  Your selections will be saved when you return
                </Text>
              </View>
            </MotiView>
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
  modal: {
    width: '100%',
    maxWidth: 420,                    // max-w-[420px]
    borderRadius: 24,                 // rounded-[24px]
    overflow: 'hidden',
    backgroundColor: Colors.neutralWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  // Header — gradient bg-gradient-to-br from-[#054A86] to-[#0768B8]
  modalHeader: {
    backgroundColor: Colors.primary,   // approximates gradient start
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    alignItems: 'center',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  iconCircle: {
    width: 56,                         // w-14 h-14
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,                      // text-[22px]
    fontWeight: '800',
    color: Colors.neutralWhite,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  // Body
  body: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    marginTop: -16,                    // overlaps header bottom
    backgroundColor: Colors.neutralWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  message: {
    fontSize: 15,
    color: Colors.neutralGrayDark,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonsCol: {
    gap: 12,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,  // bg-[#054A86]
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 15,
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.neutralWhite,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  btnOutlineText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  note: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.neutralGray,
    marginTop: 16,
  },
});
