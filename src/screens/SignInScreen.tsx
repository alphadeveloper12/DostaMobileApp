/**
 * SignInScreen — faithful translation of:
 *   web: pages/SignIn.tsx → components/signin/MainSection.tsx
 *        components/signin/SigninForm.tsx
 *        components/signin/Slider.tsx
 *        components/signin/ForgetPassword.tsx
 *
 * Web layout:
 *   Section: flex flex-row, full viewport height
 *   Left panel (45%): auth selection OR email form OR forgot password
 *   Right panel (55%): image slider (3 slides, same image, dots navigation)
 *
 * Mobile adaptation (documented):
 *   - Right panel (image slider) → shown as full-width top image, fades between slides
 *   - Left panel → full-width form below
 *   - Overall: ScrollView allows overflow content
 *   - Google OAuth → expo-auth-session (not implemented yet, button navigates to native OAuth)
 *
 * States:
 *   'selection' → shows "Sign in with email" + "Continue with Google" buttons
 *   'emailForm' → shows full email+password form (SigninForm)
 *   'forgotPassword' → shows forgot password form
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Eye, EyeOff, ChevronLeft, Mail } from 'lucide-react-native';
import axios from 'axios';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
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
import { fetchCartData } from '@/store/slices/cartSlice';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_W } = Dimensions.get('window');

// ── Slider images (same as web: all use slider-image.jpg) ─────────────────────
const SLIDES = [
  {
    img: AUTH_SLIDER,
    title: 'Crafted Cuisine. Nourishing Intent.',
    subtitle: 'We prepare elevated meals with health, care, and flavor.',
  },
  {
    img: AUTH_SLIDER,
    title: 'Fresh Ingredients. Pure Delight.',
    subtitle: 'Healthy, flavorful dishes crafted to perfection.',
  },
  {
    img: AUTH_SLIDER,
    title: 'Taste the Wellness.',
    subtitle: 'We bring nourishment with every bite.',
  },
];

// ── Logo image (dosta_blue.svg) ───────────────────────────────────────────────
import DostaBlue from '@/assets/images/nav/dosta_blue.svg';
const AUTH_SLIDER = require('@/assets/images/auth/slider-image.jpg');

// ── Google SVG icon (inline, exact from web) ──────────────────────────────────
// Rendered as expo-image with network URI
const GoogleIcon = () => (
  <Image
    source={{ uri: 'https://www.google.com/favicon.ico' }}
    style={{ width: 20, height: 20 }}
    contentFit="contain"
  />
);

// ── Image Slider (translation of web Slider.tsx) ──────────────────────────────
const AuthSlider = () => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const slide = SLIDES[current];

  return (
    <View style={styles.sliderContainer}>
      <Image
        source={{ uri: slide.img }}
        style={styles.sliderImage}
        contentFit="cover"
        transition={700}
      />
      {/* Dark overlay bg-black/30 */}
      <View style={styles.sliderOverlay} />
      {/* Text + dots */}
      <View style={styles.sliderContent}>
        <Text style={styles.sliderTitle}>{slide.title}</Text>
        <Text style={styles.sliderSubtitle}>{slide.subtitle}</Text>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setCurrent(i)}
              style={[styles.dot, i === current && styles.dotActive]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// ── Forgot Password Form (translation of ForgetPassword.tsx) ──────────────────
const ForgotPasswordForm = ({ onBack }: { onBack: () => void }) => {
  const navigation = useNavigation<any>();
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]      = useState(false);
  const [error, setError]    = useState('');

  const handleSend = async () => {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      await axios.post(`${BASE_URL}/api/password-reset/`, { email });
      setSent(true);
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to send reset email.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formPanel}>
      {/* Logo */}
      <TouchableOpacity onPress={() => navigation.navigate('Home')}>
        <DostaBlue width={135} height={24} />
      </TouchableOpacity>

      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <ChevronLeft size={20} color={Colors.neutralGrayDark} />
        <Text style={styles.backText}>Back to Signin</Text>
      </TouchableOpacity>

      {/* Heading — text-[40px] font-[800] */}
      <Text style={styles.heading}>Forgot password</Text>
      <Text style={styles.subheading}>
        Enter the email associated with your account and we'll send an email
        with instructions to reset your password.
      </Text>

      {/* Email input */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="name@example.com"
          placeholderTextColor={Colors.neutralGrayDark}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {sent && (
        <Text style={{ color: Colors.success, fontSize: 14, marginTop: 8 }}>
          Instructions sent! Check your email.
        </Text>
      )}

      {/* Send button */}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={handleSend}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Send instructions</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ── Email Sign In Form (translation of SigninForm.tsx) ────────────────────────
// Resolve the post-login destination. Auth screens are launched with an
// optional `returnTo` route param so the user is bounced back to the screen
// they came from (e.g. Cart) instead of always landing on Home.
const navigateAfterAuth = (navigation: any, route: any) => {
  const returnTo = route?.params?.returnTo;
  if (returnTo?.name) {
    navigation.reset({
      index: 0,
      routes: [{ name: returnTo.name, params: returnTo.params }],
    });
  } else {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }
};

const EmailSignInForm = ({
  onBack,
  onForgotPassword,
}: {
  onBack: () => void;
  onForgotPassword: () => void;
}) => {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const dispatch   = useDispatch();

  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPwd]    = useState(false);
  const [keepLoggedIn, setKeep]       = useState(true);
  const [loading, setLoading]         = useState(false);
  const [errorMsg, setError]          = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/login/`, { email, password });
      if (res.status === 200) {
        const data = res.data;
        await setAuthToken(data.token);
        await persistUser(data.user);
        dispatch(setUser(data.user));

        // Sync guest cart
        const guestCart = await getGuestCart();
        if (guestCart) {
          try {
            await axios.post(`${BASE_URL}/api/vending/cart/`, guestCart, {
              headers: { Authorization: `Token ${data.token}` },
            });
            await removeGuestCart();
          } catch {}
        }
        // @ts-ignore
        dispatch(fetchCartData());
        navigateAfterAuth(navigation, route);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Invalid email or password.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formPanel}>
      {/* Logo */}
      <TouchableOpacity onPress={() => navigation.navigate('Home')}>
        <DostaBlue width={135} height={24} />
      </TouchableOpacity>

      {/* Back */}
      <TouchableOpacity style={styles.backRow} onPress={onBack}>
        <ChevronLeft size={20} color={Colors.neutralGrayDark} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* "Sign in" — text-[60px] font-[700] in web */}
      <Text style={styles.signInHeading}>Sign in</Text>
      <Text style={styles.signInSubheading}>
        Sign in with your data that you entered during your registration.
      </Text>

      {/* Email */}
      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="name@example.com"
          placeholderTextColor={Colors.neutralGrayDark}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />
      </View>

      {/* Password */}
      <View style={[styles.fieldWrap, { marginTop: 28 }]}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={[styles.input, { paddingRight: 44 }]}
            placeholder="min. 8 characters"
            placeholderTextColor={Colors.neutralGrayDark}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPwd((p) => !p)}>
            {showPassword ? (
              <EyeOff size={20} color={Colors.neutralGray} />
            ) : (
              <Eye size={20} color={Colors.neutralGray} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Keep me logged in — exact from web */}
      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => setKeep((k) => !k)}>
        <View style={[styles.checkbox, keepLoggedIn && styles.checkboxActive]}>
          {keepLoggedIn && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>Keep me logged in</Text>
      </TouchableOpacity>

      {/* Error */}
      {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      {/* Login button */}
      <TouchableOpacity
        style={[styles.primaryBtn, { marginTop: 40 }]}
        onPress={handleLogin}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Login</Text>
        )}
      </TouchableOpacity>

      {/* Forgot password */}
      <TouchableOpacity
        style={{ alignSelf: 'center', marginTop: 28 }}
        onPress={onForgotPassword}>
        <Text style={styles.forgotText}>Forgot password</Text>
      </TouchableOpacity>

      {/* Create account */}
      <View style={styles.createRow}>
        <Text style={styles.createText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.createLink}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Auth Selection Panel (translation of AuthPanel in MainSection.tsx) ─────────
// Web mobile flow: user picks a method (email/google) → tile gets a blue border
// → "Continue" button (disabled until a method is picked) routes accordingly.
type Method = 'email' | 'google' | null;

const AuthSelectionPanel = ({
  onEmailPress,
}: {
  onEmailPress: () => void;
}) => {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const dispatch   = useDispatch();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<Method>(null);

  // Google OAuth via expo-auth-session
  // Web client    → used as fallback / consent screen
  // Android client → used for native Android OAuth (custom URI scheme must be
  //                  enabled in Google Cloud Console → Android client → Advanced settings)
  const WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!;
  const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID!;
  const IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID!;
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId:        WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    iosClientId:     IOS_CLIENT_ID,
    scopes:          ['profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        try {
          const { authentication } = response;
          // POST /api/google/ with access_token (identical to web)
          const res = await axios.post(`${BASE_URL}/api/google/`, {
            access_token: authentication?.accessToken,
          });
          const token    = res.data.key ?? res.data.token;
          const userData = res.data.user;
          await setAuthToken(token);
          await persistUser(userData);
          dispatch(setUser(userData));
          // Sync guest cart (identical to web)
          const guestCart = await getGuestCart();
          if (guestCart) {
            try {
              await axios.post(`${BASE_URL}/api/vending/cart/`, guestCart, {
                headers: { Authorization: `Token ${token}` },
              });
              await removeGuestCart();
            } catch {}
          }
          // @ts-ignore
          dispatch(fetchCartData());
          navigateAfterAuth(navigation, route);
        } catch (err: any) {
          const errData = err.response?.data;
          if (errData?.non_field_errors?.includes('User is already registered with this e-mail address.')) {
            Alert.alert('Account Exists', 'This email is already registered. Please sign in with your email and password.');
          } else {
            Alert.alert('Login Failed', 'Google login failed. Please try again.');
          }
        } finally {
          setGoogleLoading(false);
        }
      };
      handleGoogleLogin();
    }
  }, [response]);

  return (
    <View style={styles.formPanel}>
      {/* Logo */}
      <TouchableOpacity onPress={() => navigation.navigate('Home')}>
        <DostaBlue width={135} height={24} />
      </TouchableOpacity>

      {/* "Sign in" heading — text-[60px] font-[700] */}
      <Text style={styles.signInHeading}>Sign in</Text>

      {/* Terms text */}
      <Text style={styles.termsText}>
        By clicking Sign in with email or Google, you agree to Dosta's{' '}
        <Text
          style={styles.termsLink}
          onPress={() => navigation.navigate('Terms')}>
          Terms of Use
        </Text>{' '}
        and{' '}
        <Text
          style={styles.termsLink}
          onPress={() => navigation.navigate('PrivacyPolicy')}>
          Privacy Policy
        </Text>
        .
      </Text>

      {/* Sign in with email button — whitebg variant from web. Selected
          method gets a blue border (web's "border border-blue-400"). */}
      <View style={[styles.methodsCol, { marginTop: 32 }]}>
        <TouchableOpacity
          style={[
            styles.methodBtn,
            selectedMethod === 'email' && styles.methodBtnSelected,
          ]}
          onPress={() => setSelectedMethod('email')}
          activeOpacity={0.85}>
          <View style={styles.methodIcon}>
            <Mail size={20} color={Colors.neutralBlack} />
          </View>
          <Text style={styles.methodText}>Sign in with email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.methodBtn,
            selectedMethod === 'google' && styles.methodBtnSelected,
          ]}
          onPress={() => setSelectedMethod('google')}
          disabled={googleLoading}
          activeOpacity={0.85}>
          {googleLoading ? (
            <ActivityIndicator size="small" color={Colors.neutralBlack} />
          ) : (
            <GoogleIcon />
          )}
          <Text style={styles.methodText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>

      {/* Continue button — disabled until a method is picked (web mobile rule) */}
      <TouchableOpacity
        style={[
          styles.primaryBtn,
          { marginTop: 20 },
          !selectedMethod && styles.primaryBtnDisabled,
        ]}
        onPress={() => {
          if (selectedMethod === 'email') onEmailPress();
          else if (selectedMethod === 'google' && request) promptAsync();
        }}
        disabled={!selectedMethod || (selectedMethod === 'google' && !request)}
        activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Continue</Text>
      </TouchableOpacity>

      {/* Don't have account */}
      <View style={styles.createRow}>
        <Text style={styles.createText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.createLink}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
type AuthView = 'selection' | 'emailForm' | 'forgotPassword';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<AuthView>('selection');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.neutralWhite }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, paddingTop: insets.top }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Web mobile hides the right-side Slider entirely — only the auth
            panel is shown on phones. We follow the same rule. */}
        <AnimateOnScroll direction="up" duration={400}>
          {view === 'selection' && (
            <AuthSelectionPanel onEmailPress={() => setView('emailForm')} />
          )}
          {view === 'emailForm' && (
            <EmailSignInForm
              onBack={() => setView('selection')}
              onForgotPassword={() => setView('forgotPassword')}
            />
          )}
          {view === 'forgotPassword' && (
            <ForgotPasswordForm onBack={() => setView('emailForm')} />
          )}
        </AnimateOnScroll>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Slider
  sliderContainer: {
    width: '100%',
    height: 260,
    position: 'relative',
  },
  sliderImage: {
    width: '100%',
    height: '100%',
  },
  sliderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sliderContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sliderTitle: {
    color: Colors.neutralWhite,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  sliderSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 40,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: Colors.neutralWhite,
  },

  // Form panel — md:w-[45%] px-10 md:px-14 pt-6 on web
  formPanel: {
    paddingHorizontal: 24,          // px-[15px] sm:px-10
    paddingTop: 24,                 // pt-6
    paddingBottom: 32,
    backgroundColor: Colors.neutralWhite,
  },
  logo: {
    height: 24,
    width: 135,
    marginBottom: 0,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    gap: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutralGrayDark,
  },

  // "Sign in" heading — web text-[60px] leading-[82px]. 56/64 on phones.
  signInHeading: {
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 64,
    color: Colors.neutralBlack,     // text-[#2B2B43]
    paddingTop: 68,                 // pt-[68px]
  },
  signInSubheading: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.neutralGrayDark,
  },
  termsText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.neutralGrayDark,
    lineHeight: 24,
  },
  termsLink: {
    fontWeight: '700',
    color: Colors.primaryBlue,      // text-[#056AC1]
    textDecorationLine: 'underline',
  },

  // Auth method buttons (whitebg variant from web)
  methodsCol: {
    gap: 20,                        // space-y-5
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    borderRadius: 8,
    paddingVertical: 16,            // md:py-5
    paddingHorizontal: 16,
    backgroundColor: Colors.neutralWhite,
  },
  // Web mobile: when a method is picked the tile gets `border-blue-400`
  methodBtnSelected: {
    borderColor: '#60A5FA',
    borderWidth: 1,
  },
  methodIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutralBlack,
  },

  // Primary button — bg-[#054A86] h-11
  primaryBtn: {
    backgroundColor: Colors.primary,
    height: 44,                     // h-11
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4E60FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 5,
  },
  primaryBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  primaryBtnDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },

  // Forgot password link
  forgotText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Create account
  createRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 70,                  // mt-[70px]
  },
  createText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutralGrayDark,
  },
  createLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryBlue,
    textDecorationLine: 'underline',
  },

  // Form fields
  fieldWrap: {
    marginTop: 24,
    gap: 4,
  },
  label: {
    fontSize: 12,                   // text-xs
    fontWeight: '600',
    color: Colors.neutralGrayDark,  // text-[#545563]
    marginBottom: 4,
  },
  input: {
    height: 44,                     // h-11
    borderRadius: 8,                // rounded-lg
    borderWidth: 1,
    borderColor: Colors.neutralGrayLight, // border-[#C7C8D2]
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.neutralBlack,
    backgroundColor: Colors.neutralWhite,
  },
  passwordWrap: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  // Keep logged in
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: Colors.neutralGrayLight,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.neutralWhite,
    fontSize: 12,
    fontWeight: '700',
  },
  checkLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.neutralBlack,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },

  // Forgot password form
  heading: {
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 56,
    color: Colors.neutralBlack,
    marginTop: 24,
  },
  subheading: {
    marginTop: 22,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.neutralGrayDark,
    lineHeight: 24,
  },
});
