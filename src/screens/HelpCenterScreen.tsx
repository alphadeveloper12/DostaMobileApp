/**
 * HelpCenterScreen — translation of web static content page.
 * Source: pages/HelpCenter.tsx → components/HelpCenterContent
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

export default function HelpCenterScreen() {
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
            <Text style={styles.pageSubtitle}>We're Here to Help</Text>
            <Text style={styles.pageTitle}>Help Center</Text>
          </AnimateOnScroll>
        </View>

        {/* Content sections */}
        <View style={styles.content}>
          <AnimateOnScroll delay={0} style={styles.section}>
            <Text style={styles.sectionHeading}>Orders & Delivery</Text>
            <Text style={styles.sectionBody}>Q: How do I track my order?\nA: You can view your order status in My Orders after logging in.\n\nQ: What if an item is sold out?\nA: Items shown as sold out are no longer available for that day. Check back the next day for fresh inventory.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={100} style={styles.section}>
            <Text style={styles.sectionHeading}>Account & Billing</Text>
            <Text style={styles.sectionBody}>Q: How do I reset my password?\nA: Click 'Forgot Password' on the sign in page and follow the instructions.\n\nQ: Can I get a refund?\nA: Please see our Refund Policy for details. Contact support@dosta.ae for assistance.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={200} style={styles.section}>
            <Text style={styles.sectionHeading}>Catering</Text>
            <Text style={styles.sectionBody}>Q: How far in advance should I book?\nA: We recommend booking at least 48 hours in advance for best availability.\n\nQ: Can I modify my catering order?\nA: Contact catering@dosta.ae as soon as possible with any changes.</Text>
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
