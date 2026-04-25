/**
 * PortfolioScreen — translation of web static content page.
 * Source: pages/Portfolio.tsx → components/PortfolioContent
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

export default function PortfolioScreen() {
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
            <Text style={styles.pageSubtitle}>Our Work</Text>
            <Text style={styles.pageTitle}>Portfolio</Text>
          </AnimateOnScroll>
        </View>

        {/* Content sections */}
        <View style={styles.content}>
          <AnimateOnScroll delay={0} style={styles.section}>
            <Text style={styles.sectionHeading}>Trusted by Leading Brands</Text>
            <Text style={styles.sectionBody}>We proudly serve top companies, hospitality venues, and residential communities across the UAE.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={100} style={styles.section}>
            <Text style={styles.sectionHeading}>Corporate Events</Text>
            <Text style={styles.sectionBody}>We have catered for Fortune 500 company events, board meetings, and large-scale corporate conferences across Dubai and Abu Dhabi.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={200} style={styles.section}>
            <Text style={styles.sectionHeading}>Private Events</Text>
            <Text style={styles.sectionBody}>From royal family gatherings to intimate birthday celebrations — our team delivers exceptional experiences every time.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={300} style={styles.section}>
            <Text style={styles.sectionHeading}>Community Impact</Text>
            <Text style={styles.sectionBody}>Dosta partners with local communities and charities to provide food for those in need across the UAE.</Text>
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
