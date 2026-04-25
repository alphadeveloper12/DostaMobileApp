/**
 * Header — faithful translation of web components/layout/Header.tsx
 * SVG files are now imported locally via react-native-svg-transformer.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
// SVG files imported as React components via react-native-svg-transformer
import LogoSvg       from '@/assets/images/nav/logo.svg';
import DostaBlue     from '@/assets/images/nav/dosta_blue.svg';
import UserProfile   from '@/assets/images/nav/user_profile.svg';
import SearchBox     from '@/assets/images/nav/searchbox.svg';
import CrossBox      from '@/assets/images/nav/crossbox.svg';
import SearchIcon    from '@/assets/images/icons/search.svg';
import InboxIcon     from '@/assets/images/icons/inbox.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { X, Menu } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { Colors } from '@/utils/colors';
import { getAuthToken, removeAuthToken, removeUser, storage } from '@/utils/storage';
import { clearUser } from '@/store/slices/userSlice';
import { clearCart } from '@/store/slices/cartSlice';

export default function Header() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Check auth state on mount
  const checkAuth = useCallback(async () => {
    const token = await getAuthToken();
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLoginClick = () => {
    setIsMobileMenuOpen(false);
    navigation.navigate('SignIn');
  };

  const handleLogout = async () => {
    await removeAuthToken();
    await removeUser();
    await storage.removeItem('orderProgress');
    await storage.removeItem('selectedLocation');
    dispatch(clearUser());
    dispatch(clearCart());
    setIsLoggedIn(false);
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    navigation.navigate('SignIn');
  };

  // Dropdown menu items (same as web)
  const DropdownMenu = () => (
    <View style={styles.dropdown}>
      <TouchableOpacity
        style={styles.dropdownItem}
        onPress={() => { setIsDropdownOpen(false); navigation.navigate('MyOrders'); }}>
        <Text style={styles.dropdownText}>My Orders</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.dropdownItem}
        onPress={() => { setIsDropdownOpen(false); navigation.navigate('Settings'); }}>
        <Text style={styles.dropdownText}>Account Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.dropdownItem, styles.dropdownItemLast]}
        onPress={handleLogout}>
        <Text style={styles.dropdownText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Main header bar — h-16 (64px) + safe area top */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.inner}>

          {/* Left: Logo + nav links */}
          <View style={styles.left}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
              <LogoSvg width={135} height={24} />
            </TouchableOpacity>

            {/* Desktop nav links (hidden on narrow screens — shown as overlay on mobile) */}
            {/* On mobile these are in the hamburger menu overlay */}
          </View>

          {/* Right: login/user + hamburger */}
          <View style={styles.right}>
            {/* Auth button */}
            {isLoggedIn ? (
              <TouchableOpacity
                style={styles.userAvatar}
                onPress={() => setIsDropdownOpen(!isDropdownOpen)}>
                <UserProfile width={24} height={24} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleLoginClick}>
                <Text style={styles.loginText}>Login</Text>
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Hamburger / searchbox */}
            <TouchableOpacity onPress={() => setIsMobileMenuOpen(true)}>
              {isMobileMenuOpen ? (
                <X size={24} color={Colors.neutralWhite} />
              ) : (
                <SearchBox width={24} height={24} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Dropdown (user menu) */}
        {isDropdownOpen && isLoggedIn && <DropdownMenu />}
      </View>

      {/* Full-screen mobile menu overlay — exact web structure */}
      <Modal
        visible={isMobileMenuOpen}
        animationType="fade"
        transparent={false}
        statusBarTranslucent>
        <View style={[styles.menuOverlay, { paddingTop: insets.top }]}>
          {/* Overlay header */}
          <View style={styles.menuHeader}>
            <DostaBlue width={100} height={24} />
            <TouchableOpacity onPress={() => setIsMobileMenuOpen(false)}>
              <CrossBox width={32} height={32} />
            </TouchableOpacity>
          </View>

          {/* Menu items — centered, same as web */}
          <View style={styles.menuItems}>
            {[
              { label: 'My Orders',        screen: 'MyOrders' },
              { label: 'Account Settings', screen: 'Settings' },
            ].map(({ label, screen }) => (
              <TouchableOpacity
                key={screen}
                onPress={() => { setIsMobileMenuOpen(false); navigation.navigate(screen); }}>
                <Text style={styles.menuItemText}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={isLoggedIn ? handleLogout : handleLoginClick}>
              <Text style={styles.menuItemText}>
                {isLoggedIn ? 'Logout' : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom search bar — exact web replica */}
          <View style={styles.menuBottom}>
            <View style={styles.searchDivider} />
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor={Colors.neutralGrayDark}
                  value={searchText}
                  onChangeText={setSearchText}
                />
                <SearchIcon width={16} height={16} />
              </View>
              {/* Notification icon with badge */}
              <View style={styles.inboxWrap}>
                <InboxIcon width={20} height={20} />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>4</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primaryDark,
    zIndex: 50,
    // shadow for sticky feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  inner: {
    height: 64,                    // h-16
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  logo: {
    height: 24,                    // h-[24px]
    width: 135,                    // w-[135px]
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    position: 'relative',
  },
  loginText: {
    color: Colors.neutralWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  userAvatar: {
    width: 48,                     // w-[48px] h-[48px]
    height: 48,
    backgroundColor: Colors.neutralGray,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarImg: {
    width: 24,
    height: 24,
  },
  divider: {
    width: 1,
    height: 32,                    // h-8
    backgroundColor: Colors.neutralWhite,
    opacity: 0.4,
  },
  hamburgerIcon: {
    width: 24,
    height: 24,
  },
  // Dropdown
  dropdown: {
    position: 'absolute',
    top: 64,
    right: 0,
    width: 256,                    // w-[256px]
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,              // rounded-[16px]
    paddingVertical: 10,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  dropdownItemLast: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  dropdownText: {
    fontSize: 14,
    color: Colors.neutralDark,
  },
  // Mobile menu overlay
  menuOverlay: {
    flex: 1,
    backgroundColor: Colors.neutralWhite,
    paddingHorizontal: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,              // mb-10
    paddingTop: 20,
  },
  menuLogo: {
    height: 24,
    width: 100,
  },
  closeIcon: {
    width: 32,                     // h-8 w-8
    height: 32,
  },
  menuItems: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,                       // gap-6
    paddingTop: 68,                // pt-[68px]
  },
  menuItemText: {
    fontSize: 24,                  // text-[24px]
    lineHeight: 32,                // leading-[32px]
    fontWeight: '700',
    letterSpacing: 0.1,
    color: Colors.neutralDark,     // text-neutral-black
  },
  menuBottom: {
    paddingBottom: 20,
  },
  searchDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',   // border-gray-200
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutralGrayLightest, // bg-neutral-gray-lightest
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutralDark,
  },
  searchIcon: {
    width: 16,
    height: 16,
  },
  inboxWrap: {
    width: 40,
    height: 40,
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  inboxIcon: {
    width: 20,
    height: 20,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',   // bg-red-500
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: Colors.neutralWhite,
    fontSize: 10,
    fontWeight: '700',
  },
});
