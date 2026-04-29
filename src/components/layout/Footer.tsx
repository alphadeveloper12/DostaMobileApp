/**
 * Footer — faithful translation of web components/layout/Footer.tsx
 *
 * Web original:
 *   bg-primary-dark (#012E4E), text-white
 *   px-4 sm:px-8 md:px-[165px] py-12 max-w-[1440px]
 *   Two footer sections: "Our Company" + "Help Center" (link lists)
 *   "Download our app" section with App Store + Google Play badges
 *   Social: Facebook, Instagram, LinkedIn icons
 *   Copyright bar with horizontal links
 *
 * Adaptations:
 *   grid → View with flexWrap
 *   <Link> → TouchableOpacity + navigation.navigate
 *   Lucide social icons → lucide-react-native (same icons)
 *   App store badge images → Image with remote URI
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Facebook, Instagram, Linkedin } from 'lucide-react-native';
import { Colors } from '@/utils/colors';

// Exact footer sections from web Footer.tsx
const footerSections = [
  {
    title: 'Our Company',
    links: [
      { label: 'About us',          screen: 'AboutUs' },
      { label: 'Contact us',        screen: 'ContactUs' },
      { label: 'Privacy Policy',    screen: 'PrivacyPolicy' },
      { label: 'Cookies Policy',    screen: 'CookiesPolicy' },
      { label: 'Refund Policy',     screen: 'RefundPolicy' },
      { label: 'Terms & Conditions',screen: 'Terms' },
      { label: 'Catering',          screen: 'CateringHome' },
      { label: 'Trade Licenses',    screen: 'TradeLicenses' },
    ],
  },
  {
    title: 'Help Center',
    links: [
      { label: 'How it works', screen: 'HowItWorks' },
      { label: 'Help center',  screen: 'HelpCenter' },
      { label: 'FAQ',          screen: 'Faqs' },
      { label: 'Report a bug', screen: 'ReportBug' },
    ],
  },
];


// Social links (same as web)
const socialLinks = [
  { Icon: Facebook,  href: '#' },
  { Icon: Instagram, href: 'https://www.instagram.com/dosta.ae/' },
  { Icon: Linkedin,  href: 'https://www.linkedin.com/in/dosta-ae-7290913a4/' },
];

export default function Footer() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.footer}>
      {/* Top section */}
      <View style={styles.top}>
        {/* Link sections */}
        <View style={styles.sectionsRow}>
          {footerSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.links.map((link) => (
                <TouchableOpacity
                  key={link.label}
                  onPress={() => navigation.navigate(link.screen)}
                  style={styles.linkRow}>
                  <Text style={styles.link}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

      </View>

      {/* Bottom bar: social + copyright */}
      <View style={styles.bottom}>
        {/* Social icons */}
        <View style={styles.socialRow}>
          {socialLinks.map(({ Icon, href }) => (
            <TouchableOpacity
              key={href}
              style={styles.socialIcon}
              onPress={() => href !== '#' && Linking.openURL(href)}>
              <Icon size={20} color={Colors.neutralGray} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Legal links row */}
        <View style={styles.legalRow}>
          {[
            { label: 'Privacy Policy', screen: 'PrivacyPolicy' },
            { label: 'Terms',          screen: 'Terms' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => navigation.navigate(item.screen)}>
              <Text style={styles.legalLink}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.copyright}>
          © {new Date().getFullYear()} Dosta. All rights reserved.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: Colors.primaryDark,  // bg-primary-dark
    paddingHorizontal: 16,                 // px-4
    paddingTop: 48,                        // py-12
    paddingBottom: 32,
  },
  top: {
    marginBottom: 32,
  },
  sectionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
    marginBottom: 32,
  },
  section: {
    minWidth: 140,
  },
  sectionTitle: {
    color: Colors.neutralWhite,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,                      // mb-4
  },
  linkRow: {
    marginBottom: 8,                       // space-y-2
  },
  link: {
    color: Colors.neutralGray,             // text-gray-400
    fontSize: 14,                          // text-sm
  },
  bottom: {
    borderTopWidth: 1,
    borderTopColor: '#1a4a6a',
    paddingTop: 24,
    gap: 12,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
  },
  socialIcon: {
    padding: 4,
  },
  legalRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  legalLink: {
    color: Colors.neutralGray,
    fontSize: 12,
  },
  copyright: {
    color: Colors.neutralGray,
    fontSize: 12,
    marginTop: 4,
  },
});
