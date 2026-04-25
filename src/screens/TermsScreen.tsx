/**
 * TermsScreen — translation of web static content page.
 * Source: pages/Terms.tsx → components/TermsContent
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

export default function TermsScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}>

        {/* Page header — same as web BreadCrumb + page title pattern */}
        <View style={styles.pageHeader}>
          <BreadCrumb />
          <AnimateOnScroll>
            <Text style={styles.pageSubtitle}>Terms of Service</Text>
            <Text style={styles.pageTitle}>Terms & Conditions</Text>
          </AnimateOnScroll>
        </View>

        {/* Content sections */}
        <View style={styles.content}>
          <AnimateOnScroll delay={0} style={styles.section}>
            <Text style={styles.sectionHeading}>Acceptance of Terms</Text>
            <Text style={styles.sectionBody}>By using Dosta's services, you agree to these Terms of Service. If you do not agree, please do not use our services.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={100} style={styles.section}>
            <Text style={styles.sectionHeading}>Use of Services</Text>
            <Text style={styles.sectionBody}>You must be 18 years or older to use Dosta. You are responsible for maintaining the security of your account and all activities under it.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={200} style={styles.section}>
            <Text style={styles.sectionHeading}>Orders & Payment</Text>
            <Text style={styles.sectionBody}>All prices are in AED and include 5% VAT. Orders are confirmed upon successful payment. We reserve the right to cancel orders due to unavailability.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={300} style={styles.section}>
            <Text style={styles.sectionHeading}>Limitation of Liability</Text>
            <Text style={styles.sectionBody}>Dosta's liability is limited to the value of the order placed. We are not liable for indirect or consequential damages.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={400} style={styles.section}>
            <Text style={styles.sectionHeading}>Governing Law</Text>
            <Text style={styles.sectionBody}>These terms are governed by the laws of the United Arab Emirates.</Text>
          </AnimateOnScroll>
        </View>

        
        <Footer />
      </ScrollView>
      <MobileFooterNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.neutralWhite },
  pageHeader: {
    backgroundColor: Colors.neutralWhite,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 4,
  },
  pageSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: Colors.primary,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.primary,
    lineHeight: 48,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 12,
  },
  sectionBody: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 26,
  },
  ctaBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  ctaBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
});
