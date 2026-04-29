/**
 * BreadCrumb — translation of web components/home/BreadCrumb.tsx
 *
 * Web behaviour: derives breadcrumb segments from `location.pathname` (e.g.
 * `/vending-home/order-now` → `Home / vending-home / order-now`). Each
 * non-final segment is a link to its prefix path; the final segment is plain
 * text. The web wraps segments in `capitalize` so they display as
 * `Home / Vending-home / Order-now`.
 *
 * RN translation: routes don't have URL paths, so we maintain a route → path
 * map (matching the web's URL structure) and render the same hierarchy.
 * Tapping a non-final segment navigates to that intermediate route.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '@/utils/colors';

// Mirror of web URL paths from RootNavigator's linking config.
const ROUTE_PATHS: Record<string, string[]> = {
  Home:                 [],
  VendingHome:          ['vending-home'],
  VendingMenu:          ['vending-home', 'menu'],
  OrderNow:             ['vending-home', 'order-now'],
  Cart:                 ['vending-home', 'cart'],
  MyOrders:             ['vending-home', 'my-orders'],
  CateringHome:         ['catering'],
  CateringPlan:         ['catering', 'plan'],
  CateringConfirmation: ['catering', 'confirmation'],
  RequestCustomQuote:   ['catering', 'request-custom-quote'],
  DostaSweets:          ['dosta-sweets'],
  Settings:             ['settings'],
  SignIn:               ['signin'],
  SignUp:               ['signup'],
  AboutUs:              ['about-us'],
  Services:             ['services'],
  Portfolio:            ['portfolio'],
  ContactUs:            ['contact-us'],
  HowItWorks:           ['how-it-works'],
  HelpCenter:           ['help-center'],
  Faqs:                 ['faqs'],
  ReportBug:            ['report-bug'],
  TradeLicenses:        ['trade-licenses'],
  PrivacyPolicy:        ['privacy-policy'],
  CookiesPolicy:        ['cookies-policy'],
  RefundPolicy:         ['refund-policy'],
  Terms:                ['terms'],
  ComingSoon:           ['coming-soon'],
};

// Reverse lookup: cumulative URL path ("vending-home/menu") → route name.
// Lets a non-final breadcrumb segment know which screen to navigate to.
const PATH_TO_ROUTE: Record<string, string> = Object.entries(ROUTE_PATHS)
  .filter(([, parts]) => parts.length > 0)
  .reduce<Record<string, string>>((acc, [route, parts]) => {
    acc[parts.join('/')] = route;
    return acc;
  }, {});

// Mirror of web `capitalize` — uppercase the first letter, leave rest as-is
// (so kebab-case stays kebab-case: "vending-home" → "Vending-home").
const capFirst = (s: string) =>
  s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);

export default function BreadCrumb() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const segments = ROUTE_PATHS[route.name] ?? [];

  return (
    <View style={styles.row}>
      {/* Root: always "Home" — link */}
      <TouchableOpacity onPress={() => navigation.navigate('Home')}>
        <Text style={[styles.text, styles.linkText]}>Home</Text>
      </TouchableOpacity>

      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const cumulativePath = segments.slice(0, idx + 1).join('/');
        const targetRoute = PATH_TO_ROUTE[cumulativePath];

        return (
          <React.Fragment key={cumulativePath}>
            <Text style={styles.separator}>/</Text>
            {isLast || !targetRoute ? (
              <Text style={[styles.text, styles.currentText]}>
                {capFirst(seg)}
              </Text>
            ) : (
              <TouchableOpacity
                onPress={() => navigation.navigate(targetRoute)}>
                <Text style={[styles.text, styles.linkText]}>
                  {capFirst(seg)}
                </Text>
              </TouchableOpacity>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 12,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',           // web font-[700]
    letterSpacing: 0.1,          // web tracking-[0.1px]
  },
  // Non-current segments — clickable, web text-neutral-gray-dark
  linkText: {
    color: Colors.neutralGrayDark,
  },
  // Current segment — web text-gray-500
  currentText: {
    color: '#6B7280',
  },
  // Separator "/" — web text-gray-400 mx-1
  separator: {
    fontSize: 13,
    color: '#9CA3AF',
    marginHorizontal: 6,
    fontWeight: '700',
  },
});
