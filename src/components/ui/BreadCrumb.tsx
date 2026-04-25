/**
 * BreadCrumb — translation of web components/home/BreadCrumb.tsx
 * Web: chevron-separated path with Home link
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '@/utils/colors';

const ROUTE_LABELS: Record<string, string> = {
  Home:                 'Home',
  VendingHome:          'Vending',
  VendingMenu:          'Menu',
  OrderNow:             'Order Now',
  Cart:                 'Cart',
  MyOrders:             'My Orders',
  CateringHome:         'Catering',
  CateringPlan:         'Plan',
  CateringConfirmation: 'Confirmation',
  RequestCustomQuote:   'Request a Quote',
  DostaSweets:          'Dosta Sweets',
  Settings:             'Settings',
  SignIn:               'Sign In',
  SignUp:               'Sign Up',
  AboutUs:              'About Us',
  Services:             'Services',
  Portfolio:            'Portfolio',
  ContactUs:            'Contact Us',
  HowItWorks:           'How It Works',
  HelpCenter:           'Help Center',
  Faqs:                 'FAQs',
  ReportBug:            'Report a Bug',
  TradeLicenses:        'Trade Licenses',
  PrivacyPolicy:        'Privacy Policy',
  CookiesPolicy:        'Cookies Policy',
  RefundPolicy:         'Refund Policy',
  Terms:                'Terms',
};

export default function BreadCrumb() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const label = ROUTE_LABELS[route.name] ?? route.name;

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={() => navigation.navigate('Home')}>
        <Text style={styles.homeText}>Home</Text>
      </TouchableOpacity>
      <ChevronRight size={14} color={Colors.neutralGrayDark} />
      <Text style={styles.current}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  homeText: {
    fontSize: 13,
    color: Colors.neutralGrayDark,
  },
  current: {
    fontSize: 13,
    color: Colors.neutralGrayDark,
    fontWeight: '500',
  },
});
