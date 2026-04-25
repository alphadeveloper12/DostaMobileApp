/**
 * FaqsScreen — translation of web static content page.
 * Source: pages/Faqs.tsx → components/FaqsContent
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

export default function FaqsScreen() {
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
            <Text style={styles.pageSubtitle}>Frequently Asked Questions</Text>
            <Text style={styles.pageTitle}>FAQs</Text>
          </AnimateOnScroll>
        </View>

        {/* Content sections */}
        <View style={styles.content}>
          <AnimateOnScroll delay={0} style={styles.section}>
            <Text style={styles.sectionHeading}>What is Dosta?</Text>
            <Text style={styles.sectionBody}>Dosta is a UAE-based food technology company that operates smart vending machines with chef-prepared meals, catering services, and Dosta Sweets delivery.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={100} style={styles.section}>
            <Text style={styles.sectionHeading}>Are the meals fresh?</Text>
            <Text style={styles.sectionBody}>Yes! All meals are prepared fresh daily by certified professional chefs. We do not use frozen or reheated food in our vending machines.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={200} style={styles.section}>
            <Text style={styles.sectionHeading}>How do I subscribe to a meal plan?</Text>
            <Text style={styles.sectionBody}>Visit the Vending Menu page, select your desired days and meals, and proceed to checkout. You can choose Weekly or Monthly plans.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={300} style={styles.section}>
            <Text style={styles.sectionHeading}>Where are your vending machines?</Text>
            <Text style={styles.sectionBody}>Our machines are located across Dubai, Abu Dhabi, and Sharjah. Use the location finder on our home page or app to find the nearest machine.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={400} style={styles.section}>
            <Text style={styles.sectionHeading}>What payment methods do you accept?</Text>
            <Text style={styles.sectionBody}>We accept all major credit cards (Visa, Mastercard), Apple Pay, and Google Pay.</Text>
          </AnimateOnScroll>
          <AnimateOnScroll delay={500} style={styles.section}>
            <Text style={styles.sectionHeading}>Is there a minimum order for sweets delivery?</Text>
            <Text style={styles.sectionBody}>For delivery outside Dubai, there is a minimum order of AED 100. Delivery to Dubai is free for all orders.</Text>
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
