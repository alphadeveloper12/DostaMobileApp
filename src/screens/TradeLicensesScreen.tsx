/**
 * TradeLicensesScreen — translation of web static content page.
 * Source: pages/TradeLicenses.tsx → components/TradeLicensesContent
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

export default function TradeLicensesScreen() {
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
            <Text style={styles.pageSubtitle}>Our Credentials</Text>
            <Text style={styles.pageTitle}>Trade Licenses</Text>
          </AnimateOnScroll>
        </View>

        {/* Content sections */}
        <View style={styles.content}>
          <AnimateOnScroll delay={0} style={styles.section}>
            <Text style={styles.sectionHeading}>DOSTA VENDING MACHINES L.L.C.</Text>
            <Text style={styles.sectionBody}>Dosta operates under valid UAE trade licenses issued by the relevant UAE authorities. We are fully compliant with all local regulations.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={100} style={styles.section}>
            <Text style={styles.sectionHeading}>Licensing Information</Text>
            <Text style={styles.sectionBody}>Our trade licenses are available for review upon request by authorized parties. Please contact legal@dosta.ae for license documentation.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={200} style={styles.section}>
            <Text style={styles.sectionHeading}>Certifications</Text>
            <Text style={styles.sectionBody}>• Dubai Municipality Food Safety Certification\n• ISO 22000 Food Safety Management\n• UAE Ministry of Economy Commercial Registration</Text>
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
