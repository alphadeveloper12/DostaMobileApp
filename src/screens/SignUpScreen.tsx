/**
 * SignUpScreen — faithful translation of:
 *   web: pages/Signup.tsx → components/sighnup/LeftBar.tsx + RightBar.tsx
 *
 * Web layout:
 *   Left panel: decorative image/branding (42.35% width, hidden on mobile)
 *   Right panel (57.64%): 3-step form with progress indicators
 *
 * Step 1 — "Personal details": Email, Password, Confirm Password
 * Step 2 — "Additional info": Phone number, 2FA toggle
 * Step 3 — "Confirmation": OTP code (only if 2FA enabled)
 *
 * Web API calls (preserved exactly):
 *   POST /api/send-otp/          { phoneNumber }
 *   POST /api/signup/            { email, password, phone_number, two_factor_enabled }
 *   POST /api/verify-otp/        { email, otp }        (2FA path only)
 *
 * Adaptations:
 *   Left panel (hidden on mobile in web) → shown as top image strip on mobile
 *   Progress steps: same 3 steps, same styling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Eye, EyeOff, Check } from 'lucide-react-native';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { Colors } from '@/utils/colors';
import { BASE_URL } from '@/services/api';
import {
  setAuthToken,
  setUser as persistUser,
  getGuestCart,
  removeGuestCart,
} from '@/utils/storage';
import { setUser } from '@/store/slices/userSlice';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';

import DostaBlue from '@/assets/images/nav/dosta_blue.svg';

// Steps — same as web const steps = [1, 2, 3]
const STEPS = [1, 2, 3];

// ── Step Progress indicator (translated from web RightBar progress steps) ──────
// Web mobile: tiny circles (w-3 h-3 = 12px), connectors w-[5rem], with the
// labels stacked underneath each circle in two-line form ("Personal\nDetails").
const STEP_LABELS = [
  'Personal\nDetails',
  'Additional\nInfo',
  'Confirmation',
];

const StepProgress = ({ currentStep }: { currentStep: number }) => (
  <View style={styles.stepsRow}>
    {STEPS.map((step, index) => {
      const isCompleted = step < currentStep;
      const isActive    = step === currentStep;

      return (
        <View key={step} style={styles.stepCol}>
          <View style={styles.stepRow}>
            {/* Tiny dot — web w-3 h-3 = 12px */}
            <View
              style={[
                styles.stepDot,
                isCompleted && styles.stepDotCompleted,
                isActive    && styles.stepDotActive,
              ]}>
              {isCompleted && <Check size={9} color={Colors.neutralWhite} />}
            </View>
            {/* Connector */}
            {index < STEPS.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  isCompleted && styles.stepLineCompleted,
                ]}
              />
            )}
          </View>
          {/* Label below — text-[16px] font-[700] */}
          <Text
            style={[
              styles.stepLabel,
              isActive    && styles.stepLabelActive,
              isCompleted && styles.stepLabelCompleted,
            ]}>
            {STEP_LABELS[index]}
          </Text>
        </View>
      );
    })}
  </View>
);

// Resolve the post-signup destination. Auth screens are launched with an
// optional `returnTo` route param so the user is bounced back to the screen
// they came from (e.g. Cart) instead of always landing on Home.
function navigateAfterAuth(navigation: any, route: any) {
  const returnTo = route?.params?.returnTo;
  if (returnTo?.name) {
    navigation.reset({
      index: 0,
      routes: [{ name: returnTo.name, params: returnTo.params }],
    });
  } else {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }
}

export default function SignUpScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const dispatch   = useDispatch();

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 fields
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd,         setShowPwd]         = useState(false);
  const [showConfPwd,     setShowConfPwd]     = useState(false);

  // Step 2 fields
  const [phoneNumber,   setPhoneNumber]   = useState('');
  const [is2FAEnabled,  setIs2FA]         = useState(false);

  // Step 3 fields
  const [otp,           setOtp]           = useState('');
  const [isOtpSent,     setIsOtpSent]     = useState(false);

  // UI state
  const [loading,     setLoading]     = useState(false);
  const [emailError,  setEmailError]  = useState('');
  const [pwdError,    setPwdError]    = useState('');
  const [phoneError,  setPhoneError]  = useState('');
  const [apiError,    setApiError]    = useState('');

  // ── Validators (identical to web) ────────────────────────────────────────────
  const validateEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  const validatePassword = () =>
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(password);

  const validatePhone = (val: string) => {
    const cleaned = val.replace(/[\s-]/g, '');
    return /^(\+971|971|0)?(50|51|52|54|55|56|58|2|3|4|6|7|9)\d{7}$/.test(cleaned);
  };

  // ── API calls (identical to web) ─────────────────────────────────────────────
  const sendOtpRequest = async () => {
    try {
      setLoading(true);
      await axios.post(`${BASE_URL}/api/send-otp/`, { phoneNumber });
      setIsOtpSent(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error   ||
        err?.response?.data?.detail  ||
        'Failed to send OTP.';
      setApiError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    setApiError('');
    try {
      setLoading(true);
      const res = await axios.post(`${BASE_URL}/api/signup/`, {
        email,
        password,
        phone_number:       phoneNumber,
        two_factor_enabled: false,
      });
      await setAuthToken(res.data.token);
      await persistUser(res.data.user);
      dispatch(setUser(res.data.user));

      const guestCart = await getGuestCart();
      if (guestCart) {
        try {
          const payload = { ...guestCart, clear_all: true };
          await axios.post(`${BASE_URL}/api/vending/cart/`, payload, {
            headers: { Authorization: `Token ${res.data.token}` },
          });
          await removeGuestCart();
        } catch {}
      }
      navigateAfterAuth(navigation, route);
    } catch (err: any) {
      let msg = 'Signup failed. Please try again.';
      const data = err?.response?.data;
      if (typeof data === 'string') msg = data;
      else if (data?.email)        msg = Array.isArray(data.email) ? data.email[0] : data.email;
      else if (data?.phone_number) msg = Array.isArray(data.phone_number) ? data.phone_number[0] : data.phone_number;
      else if (data?.message)      msg = data.message;
      else if (data?.error)        msg = data.error;
      else if (data?.detail)       msg = data.detail;
      setApiError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerificationAndSignup = async () => {
    setApiError('');
    try {
      setLoading(true);
      const verifyRes = await axios.post(`${BASE_URL}/api/verify-otp/`, { email, otp });
      if (verifyRes.status === 200) {
        const res = await axios.post(`${BASE_URL}/api/signup/`, {
          email,
          password,
          phone_number:       phoneNumber,
          two_factor_enabled: true,
        });
        await setAuthToken(res.data.token);
        await persistUser(res.data.user);
        dispatch(setUser(res.data.user));
        navigateAfterAuth(navigation, route);
      } else {
        setApiError('Invalid OTP. Please try again.');
      }
    } catch (err: any) {
      let msg = 'Verification failed. Please try again.';
      const data = err?.response?.data;
      if (typeof data === 'string') msg = data;
      else if (data?.otp)     msg = Array.isArray(data.otp) ? data.otp[0] : data.otp;
      else if (data?.message) msg = data.message;
      else if (data?.error)   msg = data.error;
      else if (data?.detail)  msg = data.detail;
      setApiError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ── Next step handler (identical to web handleNext) ───────────────────────────
  const handleNext = async () => {
    setApiError('');
    try {
      if (currentStep === 1) {
        setEmailError('');
        setPwdError('');
        if (!validateEmail(email)) {
          setEmailError('Please enter a valid email address.');
          return;
        }
        if (password !== confirmPassword) {
          setPwdError('Passwords do not match.');
          return;
        }
        if (!validatePassword()) {
          setPwdError(
            'Password must be at least 8 characters, include one uppercase letter, one special character, and one number.',
          );
          return;
        }
        setCurrentStep(2);
        return;
      }

      if (currentStep === 2) {
        setPhoneError('');
        if (!phoneNumber.trim()) {
          setPhoneError('Phone number is required.');
          return;
        }
        if (!validatePhone(phoneNumber)) {
          setPhoneError('Please enter a valid UAE phone number (e.g., +971 50 123 4567).');
          return;
        }
        if (is2FAEnabled) {
          await sendOtpRequest();
          setCurrentStep(3);
        } else {
          await handleSignup();
        }
        return;
      }

      if (currentStep === 3) {
        await handleOtpVerificationAndSignup();
        return;
      }
    } catch {
      // apiError already set
    }
  };

  const handlePrevious = () => {
    setApiError('');
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // ── Step content (exact copy of web RenderStep) ───────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <View>
            <Text style={styles.stepHeading}>Personal details</Text>
            <Text style={styles.stepSubtext}>
              Enter your data that you will use for entering.
            </Text>

            {/* Email */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, emailError && styles.inputError]}
                placeholder="name@example.com"
                placeholderTextColor={Colors.neutralGray}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(v) => { setEmail(v); setEmailError(''); setApiError(''); }}
              />
              {!!emailError && <Text style={styles.fieldError}>{emailError}</Text>}
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Password</Text>
              <View>
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder="min. 8 characters"
                  placeholderTextColor={Colors.neutralGray}
                  secureTextEntry={!showPwd}
                  value={password}
                  onChangeText={(v) => { setPassword(v); setPwdError(''); setApiError(''); }}
                />
                <TouchableOpacity style={styles.eye} onPress={() => setShowPwd(p => !p)}>
                  {showPwd ? <EyeOff size={18} color={Colors.neutralGray} /> : <Eye size={18} color={Colors.neutralGray} />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Confirm Password</Text>
              <View>
                <TextInput
                  style={[styles.input, { paddingRight: 44 }]}
                  placeholder="min. 8 characters"
                  placeholderTextColor={Colors.neutralGray}
                  secureTextEntry={!showConfPwd}
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setPwdError(''); setApiError(''); }}
                />
                <TouchableOpacity style={styles.eye} onPress={() => setShowConfPwd(p => !p)}>
                  {showConfPwd ? <EyeOff size={18} color={Colors.neutralGray} /> : <Eye size={18} color={Colors.neutralGray} />}
                </TouchableOpacity>
              </View>
              {!!pwdError && <Text style={styles.fieldError}>{pwdError}</Text>}
            </View>
          </View>
        );

      case 2:
        return (
          <View>
            <Text style={styles.stepHeading}>Additional info</Text>
            <Text style={styles.stepSubtext}>
              Enter your data that you will use for entering.
            </Text>

            {/* Phone */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={[styles.input, phoneError && styles.inputError]}
                placeholder="+971 050 123 4567"
                placeholderTextColor={Colors.neutralGray}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={(v) => { setPhoneNumber(v); setPhoneError(''); setApiError(''); }}
              />
              {!!phoneError && <Text style={styles.fieldError}>{phoneError}</Text>}
            </View>

            {/* 2FA — web uses a plain checkbox, not a switch */}
            <TouchableOpacity
              style={styles.twoFARow}
              onPress={() => setIs2FA((v) => !v)}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.checkbox,
                  is2FAEnabled && styles.checkboxActive,
                ]}>
                {is2FAEnabled && <Check size={14} color={Colors.neutralWhite} />}
              </View>
              <Text style={styles.twoFALabel}>Turn on 2-factor authentication</Text>
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View>
            <Text style={styles.stepHeading}>Confirmation</Text>
            <Text style={styles.stepSubtext}>
              Enter your security code that we sent to your phone
            </Text>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Confirmation code</Text>
              <TextInput
                style={styles.input}
                placeholder="XXX - XXX - XXX"
                placeholderTextColor={Colors.neutralGray}
                keyboardType="number-pad"
                value={otp}
                onChangeText={(v) => { setOtp(v); setApiError(''); }}
              />
            </View>

            {!isOtpSent && (
              <Text style={styles.resendHint}>
                Didn't receive a code? Go back and resend OTP.
              </Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  // ── Screen render ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.neutralWhite }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, paddingTop: insets.top }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Web hides the LeftBar image entirely on mobile (`hidden lg:flex`).
            We follow the same rule — the form is the whole screen on phones. */}

        {/* Right panel — main form */}
        <View style={styles.formContainer}>
          {/* Logo */}
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <DostaBlue width={158} height={28} />
          </TouchableOpacity>

          {/* Progress steps */}
          <StepProgress currentStep={currentStep} />

          {/* Step content */}
          <AnimateOnScroll key={currentStep} direction="up" duration={300}>
            {renderStep()}
          </AnimateOnScroll>

          {/* API error */}
          {!!apiError && <Text style={styles.apiError}>{apiError}</Text>}

          {/* Navigation buttons */}
          <View style={styles.navBtns}>
            {currentStep > 1 && (
              <TouchableOpacity
                style={styles.prevBtn}
                onPress={handlePrevious}>
                <Text style={styles.prevBtnText}>Back</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.nextBtn, currentStep > 1 && { flex: 1 }]}
              onPress={handleNext}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.nextBtnText}>
                  {currentStep === 3 ? 'Verify & Continue' : 'Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Sign in link */}
          <View style={styles.signinRow}>
            <Text style={styles.signinText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.signinLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    paddingHorizontal: 16,           // web: px-[15px]
    paddingTop: 24,                  // pt-6
    paddingBottom: 32,               // pb-8
    backgroundColor: Colors.neutralWhite,
  },
  logo: {
    height: 28,
    width: 158,
    marginBottom: 44,                // pb-[44px]
  },
  // Progress: row of {dot + connector + label below}
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 32,
  },
  stepCol: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Tiny circle — w-3 h-3 rounded-full
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D1D5DB',      // bg-gray-300
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.primary, // bg-[#054A86]
  },
  stepDotCompleted: {
    backgroundColor: '#22C55E',      // bg-green-500
  },
  // Connector — w-[5rem] h-[2px]
  stepLine: {
    width: 80,
    height: 2,
    marginLeft: 12,
    backgroundColor: '#D1D5DB',
  },
  stepLineCompleted: {
    backgroundColor: '#22C55E',
  },
  // Label below dot — text-[16px] font-[700] mt-3
  stepLabel: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: Colors.neutralGray,
  },
  stepLabelActive: {
    color: Colors.primary,
  },
  stepLabelCompleted: {
    color: Colors.neutralBlack,
  },
  // Checkbox for 2FA — web uses a native checkbox with h-5 w-5
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.neutralGrayLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.neutralWhite,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  // Step content
  stepHeading: {
    fontSize: 40,                 // text-[2.5rem]
    fontWeight: '800',
    color: Colors.neutralBlack,
    marginBottom: 8,              // pb-2
  },
  stepSubtext: {
    color: Colors.neutralGrayDark,
    fontSize: 16,
    marginBottom: 28,             // pb-7
  },
  // Fields
  fieldWrap: {
    marginBottom: 28,             // pb-7
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutralGrayDark,
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',        // border-gray-300
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.neutralBlack,
    backgroundColor: Colors.neutralWhite,
  },
  inputError: {
    borderColor: Colors.error,
  },
  eye: {
    position: 'absolute',
    right: 12,
    top: 13,
  },
  fieldError: {
    color: Colors.error,
    fontSize: 14,
    marginTop: 4,
  },
  twoFARow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  twoFALabel: {
    fontSize: 16,
    color: Colors.neutralBlack,
  },
  resendHint: {
    fontSize: 12,
    color: Colors.neutralGray,
    marginTop: 8,
  },
  apiError: {
    fontSize: 14,
    color: Colors.error,
    marginTop: 8,
    marginBottom: 8,
  },
  // Nav buttons
  navBtns: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  prevBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutralDark,
  },
  nextBtn: {
    flex: 2,
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4E60FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 5,
  },
  nextBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signinText: {
    fontSize: 14,
    color: Colors.neutralGrayDark,
  },
  signinLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryBlue,
    textDecorationLine: 'underline',
  },
});
