/**
 * Newsletter — shared translation of web components/home/Newsletter.tsx
 * bg-[#EDEEF2], centered email subscription form, purple T&C links.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '@/utils/colors';

export default function Newsletter() {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');

  return (
    <View style={styles.wrap}>
      {/* h2 text-2xl font-bold text-primary */}
      <Text style={styles.title}>Subscribe for exclusive offers</Text>
      {/* p text-neutral-gray-dark text-sm */}
      <Text style={styles.subtitle}>
        Subscribe to our emails and get the latest product offers, recipe
        updates and more.
      </Text>

      {/* Email input row */}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.neutralGray}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity style={styles.btn}>
          <Text style={styles.btnText}>Subscribe</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Privacy note with purple links */}
      <Text style={styles.privacyNote}>
        By providing your email you are agreeing to receive email marketing
        from Dosta Plazi. You can opt-out at any time. See{' '}
        <Text
          style={styles.link}
          onPress={() => navigation.navigate('Terms')}>
          Terms &amp; Conditions
        </Text>{' '}
        and{' '}
        <Text
          style={styles.link}
          onPress={() => navigation.navigate('PrivacyPolicy')}>
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.neutralGrayLightest, // bg-[#EDEEF2]
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 12,
    paddingTop: 24,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.neutralGrayDark,
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    marginBottom: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLight,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.neutralBlack,
    backgroundColor: Colors.neutralWhite,
  },
  btn: {
    backgroundColor: Colors.secondary, // bg-[#FF5C60]
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.neutralGrayLight,
  },
  privacyNote: {
    fontSize: 14,
    color: Colors.neutralBlack,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  link: {
    color: Colors.purple, // text-[#8C3EEE]
  },
});
