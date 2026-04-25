/**
 * ContactUsScreen — translation of web pages/ContactUs.tsx + components/contact/ContactUsContent.tsx
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import BreadCrumb from '@/components/ui/BreadCrumb';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';

const SECTIONS = [
  {
    heading: 'General Inquiries',
    body:    'Email: hello@dosta.ae\nPhone: +971 4 XXX XXXX\nHours: Monday – Friday, 9am – 6pm',
  },
  {
    heading: 'Customer Support',
    body:    'For order issues, refunds, or technical problems:\nEmail: support@dosta.ae\nResponse time: within 24 hours',
  },
  {
    heading: 'Catering Requests',
    body:    'For catering bookings and custom quotes:\nEmail: catering@dosta.ae\nOr use our online Request a Quote form',
  },
  {
    heading: 'Our Location',
    body:    'DOSTA Head Office\nDubai, United Arab Emirates',
  },
];

export default function ContactUsScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}>

        <View style={styles.pageHeader}>
          <BreadCrumb />
          <AnimateOnScroll>
            <Text style={styles.pageSubtitle}>Get in Touch</Text>
            <Text style={styles.pageTitle}>Contact Us</Text>
          </AnimateOnScroll>
        </View>

        <View style={styles.content}>
          {SECTIONS.map((s, i) => (
            <AnimateOnScroll key={s.heading} delay={i * 100}>
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>{s.heading}</Text>
                <Text style={styles.sectionBody}>{s.body}</Text>
              </View>
            </AnimateOnScroll>
          ))}
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => navigation.navigate('RequestCustomQuote')}>
            <Text style={styles.ctaBtnText}>Request a Quote</Text>
          </TouchableOpacity>
        </View>

        <Footer />
      </ScrollView>
      <MobileFooterNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.neutralWhite },
  pageHeader:   { backgroundColor: Colors.neutralWhite, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  pageSubtitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, color: Colors.primary, marginBottom: 8 },
  pageTitle:    { fontSize: 40, fontWeight: '800', color: Colors.primary, lineHeight: 48 },
  content:      { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, maxWidth: 800, alignSelf: 'center', width: '100%' },
  section:      { marginBottom: 32 },
  sectionHeading:{ fontSize: 22, fontWeight: '700', color: Colors.primary, marginBottom: 12 },
  sectionBody:  { fontSize: 16, color: '#4B5563', lineHeight: 26 },
  ctaBtn:       { backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 24, alignSelf: 'flex-start', marginTop: 16 },
  ctaBtnText:   { color: Colors.neutralWhite, fontWeight: '700', fontSize: 14 },
});
