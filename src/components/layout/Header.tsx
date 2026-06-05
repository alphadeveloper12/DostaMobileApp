/**
 * Header — supports three variants:
 *   - "home"     (default): dark-blue bg, regular logo, login/profile + search.
 *                Mirrors web's generic Header.tsx (used on /, /services, /about).
 *   - "vending"  : white bg + bottom border, vending logo, cart-with-badge +
 *                  search. Mirrors web's VendingHeader on mobile.
 *   - "catering" : same shape as vending, but catering logo. Mirrors web's
 *                  Catering Header on mobile.
 *
 * The cart badge for non-home variants reads `selectTotalCartItems` from the
 * cart Redux slice — same selector the web uses — so it stays in sync with
 * `syncLocalCart` writes (guest cart) and `fetchCartData` (authed cart).
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
  Image as RNImage,
} from 'react-native';
// SVG files imported as React components via react-native-svg-transformer
import LogoSvg         from '@/assets/images/nav/logo.svg';
import VendingLogo     from '@/assets/images/nav/vending_logo.svg';
import CateringLogo    from '@/assets/images/nav/catering_logo.svg';
// Beit Nahla uses a raster PNG logo (web swaps to /images/header/nahla.png on
// /beit-nahla). Rendered via RN core Image — it's a require()'d local asset.
const NahlaLogo = require('@/assets/images/header/nahla.png');
import DostaBlue       from '@/assets/images/nav/dosta_blue.svg';
import UserProfile     from '@/assets/images/nav/user_profile.svg';
import SearchBox       from '@/assets/images/nav/searchbox.svg';
import CrossBox        from '@/assets/images/nav/crossbox.svg';
import SearchIcon      from '@/assets/images/icons/search.svg';
import InboxIcon       from '@/assets/images/icons/inbox.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, Search } from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Colors } from '@/utils/colors';
import { getAuthToken, removeAuthToken, removeUser, storage } from '@/utils/storage';
import { clearUser } from '@/store/slices/userSlice';
import { clearCart, selectTotalCartItems, fetchCartData } from '@/store/slices/cartSlice';
import { useLang, toggleLang } from '@/utils/i18n';

type HeaderVariant = 'home' | 'vending' | 'catering' | 'beitnahla';

export default function Header({ variant = 'home' }: { variant?: HeaderVariant }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const totalCartItems = useSelector(selectTotalCartItems) as number;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Current app language. Mirrors web's `googtrans=/en/ar` cookie check —
  // the toggle button's label flips between "العربية" and "English"
  // based on this value.
  const lang = useLang();

  // catering & vending = white-bg variant. home & beitnahla = dark bg: the web
  // /beit-nahla page uses the generic dark Header (bg-primary-dark) with the
  // login/profile controls, not the white vending header.
  const isLight = variant !== 'home' && variant !== 'beitnahla';

  const checkAuth = useCallback(async () => {
    const token = await getAuthToken();
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // Hydrate the cart badge on Vending/Catering mount. Without this, a guest
  // who closes and reopens the app sees a stale "0" badge even though their
  // guestCart in AsyncStorage still has items. fetchCartData reads from the
  // server when authed and from getGuestCart when not — same selector
  // (`selectTotalCartItems`) drives both code paths.
  useEffect(() => {
    if (isLight) dispatch(fetchCartData() as any);
  }, [isLight, dispatch]);

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

  // Dropdown menu items (logged-in only, shown on home variant when avatar tapped)
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

  // Logo per variant — vending/catering logos already include the "DOSTA |
  // VENDING" / "DOSTA | CATERING" text rendered as a single SVG. Beit Nahla
  // uses a raster PNG (web swaps to nahla.png on /beit-nahla).
  const isBeitNahla = variant === 'beitnahla';
  const Logo =
    variant === 'vending'  ? VendingLogo  :
    variant === 'catering' ? CateringLogo :
    LogoSvg;
  const logoWidth  = variant === 'home' ? 135 : 180;
  const logoHeight = variant === 'home' ? 24  : 22;

  return (
    <>
      <StatusBar
        barStyle={isLight ? 'dark-content' : 'light-content'}
        backgroundColor={isLight ? Colors.neutralWhite : Colors.primaryDark}
      />

      <View
        style={[
          styles.header,
          isLight ? styles.headerLight : styles.headerDark,
          { paddingTop: insets.top },
        ]}>
        <View style={styles.inner}>
          {/* Left: Logo */}
          <View style={styles.left}>
            <TouchableOpacity onPress={() => navigation.navigate('Home')}>
              {isBeitNahla ? (
                <RNImage
                  source={NahlaLogo}
                  style={styles.beitNahlaLogo}
                  resizeMode="contain"
                />
              ) : (
                <Logo width={logoWidth} height={logoHeight} />
              )}
            </TouchableOpacity>
          </View>

          {/* Right: variant-dependent controls */}
          <View style={styles.right}>
            {isLight ? (
              <>
                {/* Cart icon with red badge — wired to selectTotalCartItems */}
                <TouchableOpacity
                  style={styles.cartButton}
                  onPress={() => navigation.navigate('Cart')}>
                  <InboxIcon width={22} height={22} />
                  {totalCartItems > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>
                        {totalCartItems > 99 ? '99+' : totalCartItems}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.dividerLight} />

                <TouchableOpacity
                  style={styles.searchButton}
                  onPress={() => setIsMobileMenuOpen(true)}>
                  {isMobileMenuOpen
                    ? <X size={22} color={Colors.neutralBlack} />
                    : <Search size={22} color={Colors.neutralBlack} />}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Home variant — login/profile + search/X */}
                {isLoggedIn ? (
                  <TouchableOpacity onPress={() => setIsDropdownOpen(!isDropdownOpen)}>
                    <UserProfile width={36} height={36} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={handleLoginClick}>
                    <Text style={styles.loginText}>Login</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.dividerDark} />

                <TouchableOpacity onPress={() => setIsMobileMenuOpen(true)}>
                  {isMobileMenuOpen
                    ? <X size={32} color={Colors.neutralWhite} />
                    : <SearchBox width={36} height={36} />}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {isDropdownOpen && isLoggedIn && !isLight && <DropdownMenu />}
      </View>

      {/* Full-screen mobile menu overlay (drawer) — same on every variant */}
      <Modal
        visible={isMobileMenuOpen}
        animationType="fade"
        transparent={false}
        statusBarTranslucent>
        <View style={[styles.menuOverlay, { paddingTop: insets.top }]}>
          <View style={styles.menuHeader}>
            <DostaBlue width={100} height={24} />
            <TouchableOpacity onPress={() => setIsMobileMenuOpen(false)}>
              <CrossBox width={32} height={32} />
            </TouchableOpacity>
          </View>

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

            {/* Language toggle — same UX as web Header.tsx:
                  • shows "العربية" when currently English  → tap switches to Arabic
                  • shows "English" when currently Arabic   → tap switches back
                Powered by `setLang` from utils/i18n which persists the choice
                and triggers an app-wide re-render of every <Text>. */}
            <TouchableOpacity onPress={() => toggleLang()}>
              <Text style={styles.menuItemText}>
                {lang === 'ar' ? 'English' : 'العربية'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={isLoggedIn ? handleLogout : handleLoginClick}>
              <Text style={styles.menuItemText}>
                {isLoggedIn ? 'Logout' : 'Login'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.menuBottom}>
            <View style={styles.searchDivider} />
            <View style={styles.searchRow}>
              {/* Search box is intentionally read-only in the drawer — the
                  app's search experience isn't wired up yet. Mirrors web:
                  the field is decorative until search is built. */}
              <View style={styles.searchBox} pointerEvents="none">
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor={Colors.neutralGrayDark}
                  editable={false}
                  selectTextOnFocus={false}
                />
                <SearchIcon width={16} height={16} />
              </View>
              <View style={styles.inboxWrap}>
                <InboxIcon width={20} height={20} />
                {totalCartItems > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {totalCartItems > 99 ? '99+' : totalCartItems}
                    </Text>
                  </View>
                )}
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
    zIndex: 50,
  },
  headerDark: {
    backgroundColor: Colors.primaryDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  headerLight: {
    backgroundColor: Colors.neutralWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutralGrayLightest, // #EDEEF2
  },
  inner: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // Beit Nahla raster logo — contain so the PNG keeps its aspect ratio.
  beitNahlaLogo: {
    width: 120,
    height: 40,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  loginText: {
    color: Colors.neutralWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  // Light-variant cart + search buttons — bg-neutral-gray-lightest p-3 rounded-xl
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.neutralGrayLightest,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',  // bg-red-500
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: Colors.neutralWhite,
    fontSize: 11,
    fontWeight: '700',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.neutralGrayLightest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerLight: {
    width: 1,
    height: 24,
    backgroundColor: Colors.neutralGrayLightest, // #EDEEF2 — divider on white bg
  },
  dividerDark: {
    width: 1,
    height: 32,
    backgroundColor: Colors.neutralWhite,
  },
  // Logged-in dropdown
  dropdown: {
    position: 'absolute',
    top: 64,
    right: 0,
    width: 256,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
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
  // Drawer
  menuOverlay: {
    flex: 1,
    backgroundColor: Colors.neutralWhite,
    paddingHorizontal: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
    paddingTop: 20,
  },
  menuItems: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 68,
  },
  menuItemText: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: 0.1,
    color: Colors.neutralDark,
  },
  menuBottom: { paddingBottom: 20 },
  searchDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.neutralDark },
  inboxWrap: {
    width: 40,
    height: 40,
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: Colors.neutralWhite,
    fontSize: 10,
    fontWeight: '700',
  },
});
