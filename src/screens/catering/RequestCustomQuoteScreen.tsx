/**
 * RequestCustomQuoteScreen — faithful translation of web RequestCustomQuote.tsx
 *
 * Web structure:
 *   Header
 *   BreadCrumb + h1 "Catering Service Confirmation" / "Confirmation Message"
 *   Rounded card border border-[#EDEEF2] bg-white p-6
 *   FORM (before submitted):
 *     h3 "Request Your Custom Quote" text-[24px] font-bold
 *     h4 "Let us know what you need..." text-xl text-[#545563] font-semibold
 *     p explanation text
 *     Radio fieldset:
 *       • "Email registered to your account" (default)
 *       • "Send to a different email address" → shows TextInput for email
 *     [Submit] button disabled until email valid
 *   SUCCESS (after submitted):
 *     CheckCircle2 icon
 *     h2 "Quote Request Submitted!"
 *     p "We've sent a confirmation to {email}"
 *     [Back to Home] button
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle2, Mail } from 'lucide-react-native';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import BreadCrumb from '@/components/ui/BreadCrumb';

export default function RequestCustomQuoteScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [sendTo,     setSendTo]     = useState<'registered' | 'other'>('registered');
  const [otherEmail, setOtherEmail] = useState('');
  const [submitted,  setSubmitted]  = useState(false);

  const emailRegex  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = sendTo === 'other' ? emailRegex.test(otherEmail.trim()) : true;
  const canSubmit    = isEmailValid;

  const selectedEmail =
    sendTo === 'other' && otherEmail.trim() ? otherEmail.trim() : '[email address]';

  return (
    <KeyboardAvoidingView
      style={[s.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header />

      {/* Title bar */}
      <View style={s.titleBar}>
        <BreadCrumb />
        <Text style={s.pageTitle}>
          {!submitted ? 'Catering Service Confirmation' : 'Confirmation Message'}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.card}>

          {/* ── FORM ────────────────────────────────────────── */}
          {!submitted ? (
            <View style={s.formSection}>
              {/* h3 */}
              <Text style={s.formTitle}>Request Your Custom Quote</Text>
              {/* h4 */}
              <Text style={s.formSubtitle}>
                Let us know what you need and we'll send a quote straight to your inbox.
              </Text>
              {/* p */}
              <Text style={s.formBody}>
                Fill out the form below with your specific requirements. You can choose to receive
                your quote at the email registered to your account or send it to another address.
                We'll get back to you within 24–48 hours.
              </Text>

              {/* Radio options */}
              <View style={s.radioGroup}>
                {/* Registered email */}
                <TouchableOpacity
                  style={s.radioRow}
                  onPress={() => setSendTo('registered')}>
                  <View style={[s.radioCircle, sendTo === 'registered' && s.radioCircleActive]}>
                    {sendTo === 'registered' && <View style={s.radioDot} />}
                  </View>
                  <Text style={s.radioLabel}>Email registered to your account</Text>
                </TouchableOpacity>

                {/* Other email */}
                <TouchableOpacity
                  style={s.radioRow}
                  onPress={() => setSendTo('other')}>
                  <View style={[s.radioCircle, sendTo === 'other' && s.radioCircleActive]}>
                    {sendTo === 'other' && <View style={s.radioDot} />}
                  </View>
                  <Text style={s.radioLabel}>Send to a different email address</Text>
                </TouchableOpacity>

                {sendTo === 'other' && (
                  <TextInput
                    style={[s.emailInput, !isEmailValid && otherEmail ? s.emailInputError : null]}
                    placeholder="Enter email address"
                    placeholderTextColor={Colors.neutralGrayDark}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={otherEmail}
                    onChangeText={setOtherEmail}
                  />
                )}
              </View>

              {/* Preview text */}
              <View style={s.previewBox}>
                <Mail size={16} color={Colors.neutralGrayDark} style={{ marginRight: 8 }} />
                <Text style={s.previewText}>
                  Your quote will be sent to{' '}
                  <Text style={{ fontWeight: '700', color: Colors.primary }}>
                    {selectedEmail}
                  </Text>
                </Text>
              </View>

              {/* Submit button */}
              <TouchableOpacity
                style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
                onPress={() => canSubmit && setSubmitted(true)}
                disabled={!canSubmit}>
                <Text style={s.submitBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ── SUCCESS STATE ─────────────────────────────────
            <View style={s.successSection}>
              <CheckCircle2 size={56} color="#1ABF70" style={{ marginBottom: 16 }} />
              <Text style={s.successTitle}>Quote Request Submitted!</Text>
              <Text style={s.successBody}>
                We've sent a confirmation to{' '}
                <Text style={{ fontWeight: '700', color: Colors.primary }}>{selectedEmail}</Text>
                {'\n\n'}Our catering team will review your requirements and send you a detailed
                quote within 24–48 hours. If you have any questions, please don't hesitate to
                contact us.
              </Text>
              <TouchableOpacity
                style={s.submitBtn}
                onPress={() => navigation.navigate('Home')}>
                <Text style={s.submitBtnText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Footer />
      </ScrollView>
      <MobileFooterNav />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.background },
  titleBar:     { backgroundColor: Colors.neutralWhite, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  pageTitle:    { fontSize: 28, fontWeight: '700', color: Colors.primary, lineHeight: 36 },
  card:         { backgroundColor: Colors.neutralWhite, borderRadius: 16, borderWidth: 1, borderColor: Colors.neutralGrayLightest, padding: 24, marginBottom: 16 },
  // Form
  formSection:  { gap: 20 },
  formTitle:    { fontSize: 24, fontWeight: '700', color: Colors.neutralBlack, lineHeight: 32 },
  formSubtitle: { fontSize: 18, fontWeight: '600', color: Colors.neutralGrayDark, lineHeight: 26 },
  formBody:     { fontSize: 16, fontWeight: '400', color: Colors.neutralGrayDark, lineHeight: 24 },
  // Radio
  radioGroup:   { gap: 16 },
  radioRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioCircle:  { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.neutralGrayLight, alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { borderColor: Colors.primary },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  radioLabel:   { fontSize: 16, color: Colors.neutralBlack, fontWeight: '400', flex: 1 },
  emailInput:   { height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.neutralGrayLight, paddingHorizontal: 12, fontSize: 14, color: Colors.neutralBlack, marginLeft: 32 },
  emailInputError: { borderColor: Colors.error },
  previewBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: 8, padding: 12 },
  previewText:  { fontSize: 14, color: Colors.neutralGrayDark, flex: 1 },
  submitBtn:    { height: 44, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:{ color: Colors.neutralWhite, fontSize: 14, fontWeight: '700' },
  // Success
  successSection:{ alignItems: 'center', gap: 16 },
  successTitle:  { fontSize: 24, fontWeight: '700', color: Colors.neutralBlack, textAlign: 'center' },
  successBody:   { fontSize: 16, color: Colors.neutralGrayDark, textAlign: 'center', lineHeight: 24 },
});
