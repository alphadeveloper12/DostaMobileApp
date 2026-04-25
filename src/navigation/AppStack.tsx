/**
 * AppStack — main navigator wiring all 29 screens to their routes.
 * Screen paths mirror web routes exactly.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Core screens
import HomeScreen            from '@/screens/HomeScreen';
import VendingHomeScreen     from '@/screens/VendingHomeScreen';
import VendingMenuScreen     from '@/screens/VendingMenuScreen';
import OrderNowScreen        from '@/screens/OrderNowScreen';
import CartScreen            from '@/screens/CartScreen';
import MyOrdersScreen        from '@/screens/MyOrdersScreen';

// Catering
import CateringHomeScreen        from '@/screens/catering/CateringHomeScreen';
import CateringPlanScreen        from '@/screens/catering/CateringPlanScreen';
import CateringConfirmationScreen from '@/screens/catering/CateringConfirmationScreen';
import RequestCustomQuoteScreen  from '@/screens/catering/RequestCustomQuoteScreen';

// Sweets
import DostaSweets from '@/screens/DostaSweets';

// Auth
import SignInScreen from '@/screens/SignInScreen';
import SignUpScreen from '@/screens/SignUpScreen';

// Settings
import SettingsScreen from '@/screens/SettingsScreen';

// Static content
import AboutUsScreen      from '@/screens/AboutUsScreen';
import ServicesScreen     from '@/screens/ServicesScreen';
import PortfolioScreen    from '@/screens/PortfolioScreen';
import ContactUsScreen    from '@/screens/ContactUsScreen';
import HowItWorksScreen   from '@/screens/HowItWorksScreen';
import HelpCenterScreen   from '@/screens/HelpCenterScreen';
import FaqsScreen         from '@/screens/FaqsScreen';
import ReportBugScreen    from '@/screens/ReportBugScreen';
import TradeLicensesScreen  from '@/screens/TradeLicensesScreen';
import PrivacyPolicyScreen  from '@/screens/PrivacyPolicyScreen';
import CookiesPolicyScreen  from '@/screens/CookiesPolicyScreen';
import RefundPolicyScreen   from '@/screens/RefundPolicyScreen';
import TermsScreen          from '@/screens/TermsScreen';
import ComingSoonScreen     from '@/screens/ComingSoonScreen';
import NotFoundScreen       from '@/screens/NotFoundScreen';

export type AppStackParamList = {
  Home:                 undefined;
  VendingHome:          undefined;
  VendingMenu:          undefined;
  OrderNow:             undefined;
  Cart:                 { payment_success?: string; order_id?: string; cart_id?: string } | undefined;
  MyOrders:             undefined;
  CateringHome:         undefined;
  CateringPlan:         { payment_success?: string } | undefined;
  CateringConfirmation: { orderId?: string; orderDetails?: any; extraDetails?: any } | undefined;
  RequestCustomQuote:   undefined;
  DostaSweets:          undefined;
  SignIn:               undefined;
  SignUp:               undefined;
  Settings:             undefined;
  AboutUs:              undefined;
  Services:             undefined;
  Portfolio:            undefined;
  ContactUs:            undefined;
  HowItWorks:           undefined;
  HelpCenter:           undefined;
  Faqs:                 undefined;
  ReportBug:            undefined;
  TradeLicenses:        undefined;
  PrivacyPolicy:        undefined;
  CookiesPolicy:        undefined;
  RefundPolicy:         undefined;
  Terms:                undefined;
  ComingSoon:           undefined;
  NotFound:             undefined;
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}>
      {/* Main */}
      <Stack.Screen name="Home"          component={HomeScreen} />
      <Stack.Screen name="VendingHome"   component={VendingHomeScreen} />
      <Stack.Screen name="VendingMenu"   component={VendingMenuScreen} />
      <Stack.Screen name="OrderNow"      component={OrderNowScreen} />
      <Stack.Screen name="Cart"          component={CartScreen} />
      <Stack.Screen name="MyOrders"      component={MyOrdersScreen} />

      {/* Catering */}
      <Stack.Screen name="CateringHome"        component={CateringHomeScreen} />
      <Stack.Screen name="CateringPlan"        component={CateringPlanScreen} />
      <Stack.Screen name="CateringConfirmation"component={CateringConfirmationScreen} />
      <Stack.Screen name="RequestCustomQuote"  component={RequestCustomQuoteScreen} />

      {/* Sweets */}
      <Stack.Screen name="DostaSweets"   component={DostaSweets} />

      {/* Auth */}
      <Stack.Screen name="SignIn"        component={SignInScreen} />
      <Stack.Screen name="SignUp"        component={SignUpScreen} />

      {/* Settings */}
      <Stack.Screen name="Settings"      component={SettingsScreen} />

      {/* Static content */}
      <Stack.Screen name="AboutUs"       component={AboutUsScreen} />
      <Stack.Screen name="Services"      component={ServicesScreen} />
      <Stack.Screen name="Portfolio"     component={PortfolioScreen} />
      <Stack.Screen name="ContactUs"     component={ContactUsScreen} />
      <Stack.Screen name="HowItWorks"    component={HowItWorksScreen} />
      <Stack.Screen name="HelpCenter"    component={HelpCenterScreen} />
      <Stack.Screen name="Faqs"          component={FaqsScreen} />
      <Stack.Screen name="ReportBug"     component={ReportBugScreen} />
      <Stack.Screen name="TradeLicenses" component={TradeLicensesScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="CookiesPolicy" component={CookiesPolicyScreen} />
      <Stack.Screen name="RefundPolicy"  component={RefundPolicyScreen} />
      <Stack.Screen name="Terms"         component={TermsScreen} />
      <Stack.Screen name="ComingSoon"    component={ComingSoonScreen} />
      <Stack.Screen name="NotFound"      component={NotFoundScreen} />
    </Stack.Navigator>
  );
}
