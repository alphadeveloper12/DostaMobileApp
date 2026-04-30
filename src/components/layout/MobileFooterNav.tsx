/**
 * MobileFooterNav — faithful translation of web components/home/MobileFooterNav.tsx
 * h-[82px], bg-primary-dark (#012E4E), 4 tabs with local SVG icons.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { Colors } from "@/utils/colors";

// Local SVG components via react-native-svg-transformer
import HomeIcon from "@/assets/images/icons/dosta_home.svg";
import ServicesIcon from "@/assets/images/icons/services.svg";
import OrdersIcon from "@/assets/images/icons/orders.svg";
import SettingsIcon from "@/assets/images/icons/settings.svg";

// Tabs that require an authenticated user. If the user is logged out,
// tapping these routes us directly to SignIn instead — so the protected
// screen never enters the navigation stack and back from SignIn cannot
// reveal it.
const PROTECTED_ROUTES = new Set(["MyOrders", "Settings"]);

const navItems = [
 { href: "Home", Icon: HomeIcon, label: "Dosta Home" },
 { href: "Services", Icon: ServicesIcon, label: "Services" },
 { href: "MyOrders", Icon: OrdersIcon, label: "My Orders" },
 { href: "Settings", Icon: SettingsIcon, label: "Settings" },
];

export default function MobileFooterNav() {
 const insets = useSafeAreaInsets();
 const navigation = useNavigation<any>();
 const route = useRoute();
 const user = useSelector((s: any) => s.user?.user);
 const isLoggedIn = !!user;

 const handlePress = (href: string) => {
  if (PROTECTED_ROUTES.has(href) && !isLoggedIn) {
   navigation.navigate("SignIn");
   return;
  }
  navigation.navigate(href);
 };

 return (
  <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
   <View style={styles.row}>
    {navItems.map(({ href, Icon, label }) => {
     const isActive = route.name === href;
     return (
      <TouchableOpacity
       key={href}
       style={styles.tab}
       onPress={() => handlePress(href)}
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
  </View>
 );
}

const styles = StyleSheet.create({
 nav: {
  backgroundColor: Colors.primaryDark,
  paddingHorizontal: 16,
  zIndex: 40,
  // shadow lifts the bar above scroll content for clarity
  shadowColor: "#000",
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.15,
  shadowRadius: 4,
  elevation: 12,
 },
 row: {
  height: 70,
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: 8,
  paddingBottom: 8,
 },
 tab: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  height: "100%",
  position: "relative",
 },
 label: {
  fontSize: 10,
  lineHeight: 14,
  fontWeight: "700",
  color: Colors.neutralWhite,
 },
 labelActive: {},
 activeLine: {
  position: "absolute",
  bottom: 0,
  left: "20%",
  right: "20%",
  height: 2,
  backgroundColor: Colors.neutralWhite,
  borderRadius: 1,
 },
});
