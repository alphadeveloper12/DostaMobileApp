/**
 * MobileFooterNav — faithful translation of web components/home/MobileFooterNav.tsx
 * h-[82px], bg-primary-dark (#012E4E), 4 tabs with local SVG icons.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '@/utils/colors';

// Local SVG components via react-native-svg-transformer
import HomeIcon     from '@/assets/images/icons/dosta_home.svg';
import ServicesIcon from '@/assets/images/icons/services.svg';
import OrdersIcon   from '@/assets/images/icons/orders.svg';
import SettingsIcon from '@/assets/images/icons/settings.svg';

const navItems = [
  { href: 'Home',     Icon: HomeIcon,     label: 'Dosta Home' },
  { href: 'Services', Icon: ServicesIcon, label: 'Services'   },
  { href: 'MyOrders', Icon: OrdersIcon,   label: 'My Orders'  },
  { href: 'Settings', Icon: SettingsIcon, label: 'Settings'   },
];

export default function MobileFooterNav() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute();

  return (
    <View style={[styles.nav, { paddingBottom: insets.bottom || 0 }]}>
      {navItems.map(({ href, Icon, label }) => {
        const isActive = route.name === href;
        return (
          <TouchableOpacity
            key={href}
            style={styles.tab}
            onPress={() => navigation.navigate(href)}
            activeOpacity={0.7}>
            <Icon width={24} height={24} />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {label}
            </Text>
            {isActive && <View style={styles.activeLine} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 82,
    backgroundColor: Colors.primaryDark,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 5,
    zIndex: 40,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: Colors.neutralWhite,
  },
  labelActive: {},
  activeLine: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 1,
  },
});
