/**
 * RootNavigator — handles app hydration, deep-link config, and root routing.
 *
 * Deep link scheme: dosta://
 * Payment return:   dosta://cart?payment_success=true&order_id=123
 * Catering return:  dosta://catering/plan?payment_success=true
 */

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { hydrateStore } from '@/store/hydrateStore';
import { getAuthToken } from '@/utils/storage';
import { Colors } from '@/utils/colors';
import AppStack from './AppStack';

export type RootStackParamList = {
  App: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep-link config — dosta:// scheme registered in app.json
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['dosta://', 'https://dosta.cloud'],
  config: {
    screens: {
      App: {
        screens: {
          // Payment return: dosta://cart?payment_success=true&order_id=X
          Cart: {
            path: 'cart',
            parse: {
              payment_success: (v: string) => v,
              order_id:        (v: string) => v,
              cart_id:         (v: string) => v,
            },
          },
          // Catering payment return
          CateringPlan: {
            path: 'catering/plan',
            parse: { payment_success: (v: string) => v },
          },
          // Standard screens matching web routes
          Home:                 'home',
          VendingHome:          'vending-home',
          VendingMenu:          'vending-home/menu',
          OrderNow:             'vending-home/order-now',
          MyOrders:             'vending-home/my-orders',
          CateringHome:         'catering',
          CateringConfirmation: 'catering/confirmation',
          RequestCustomQuote:   'catering/request-custom-quote',
          DostaSweets:          'dosta-sweets',
          SignIn:               'signin',
          SignUp:               'signup',
          Settings:             'settings',
          AboutUs:              'about-us',
          Services:             'services',
          Portfolio:            'portfolio',
          ContactUs:            'contact-us',
          HowItWorks:           'how-it-works',
          HelpCenter:           'help-center',
          Faqs:                 'faqs',
          ReportBug:            'report-bug',
          TradeLicenses:        'trade-licenses',
          PrivacyPolicy:        'privacy-policy',
          CookiesPolicy:        'cookies-policy',
          RefundPolicy:         'refund-policy',
          Terms:                'terms',
          ComingSoon:           'coming-soon',
        },
      },
    },
  },
};

export default function RootNavigator() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const init = async () => {
      await hydrateStore();
      setHydrated(true);
    };
    init();
  }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.neutralWhite }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="App" component={AppStack} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
