/**
 * VendingHomeScreen — faithful translation of:
 *   web: pages/VendingHome.tsx
 *        components/vending_home/HeroSection.tsx   (hero bg + location sidebar)
 *        components/vending_home/SliderSection.tsx (Embla day-meal carousel)
 *        components/vending_home/GetApp.tsx
 *
 * Web HeroSection (vending):
 *   - Full-width bg image: /images/vending_home/hero-vending.png h-[512px]
 *   - Dark overlay: md:bg-black/30
 *   - Centered white card: max-w-[585px] rounded-2xl bg-white shadow px-[64px] py-8
 *     - h1 text-[40px] font-extrabold text-[#054A86] "Meals on Your Schedule"
 *     - p text-[20px] font-semibold text-[#545563]
 *     - Search input: bg-[#EDEEF2] rounded-xl px-5 py-3 → opens sidebar on click
 *     - "Or browse our vending meals" link text-[#056AC1]
 *     - meal browse image: /images/vending_home/meal_browes.png
 *   - Sidebar: slides from right, full height
 *     - Header: "Vending Locator" text-[28px] font-[700]
 *     - Search input bg-[#EDEEF2] rounded-[12px]
 *     - Toggle tabs: List View | Map View (bg-[#054A86] text-white when active)
 *     - Location list: border border-gray-200 rounded-2xl shadow-md p-4
 *       - Selected badge: bg-[#A7CF38] text-[#054A86]
 *       - Location name text-[20px] font-[700], info text-[14px]
 *       - [Select This Location] button border border-gray-400 rounded-md
 *
 * Web SliderSection:
 *   - Embla carousel, 5 Mon–Fri slides
 *   - Each slide: image + day label + blurb + nav arrows
 *
 * Logic preserved:
 *   - fetchLocations() on mount (Redux)
 *   - localStorage.getItem("selectedLocation") → AsyncStorage
 *   - handleLocationSelect → AsyncStorage + Redux
 *   - Search filter on location name/info
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, ChevronLeft, ChevronRight, Search } from 'lucide-react-native';
import Carousel from '@/components/ui/Carousel';
import { useDispatch, useSelector } from 'react-redux';
import { MotiView } from 'moti';
import { Colors } from '@/utils/colors';
import {
  fetchLocations,
  selectAllLocations,
  getLocationsStatus,
} from '@/store/slices/vendingLocationsSlice';
import {
  getSelectedLocation,
  setSelectedLocation as persistLocation,
} from '@/utils/storage';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Exact slide data from SliderSection.tsx
const DAY_SLIDES = [
  {
    day: 'Monday',
    img: 'https://images.unsplash.com/photo-1526318472351-c75fcf070305?q=80&w=800&auto=format&fit=crop',
    blurb: 'Many variations of meals of Lorem Ipsum available the majority.',
  },
  {
    day: 'Tuesday',
    img: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop',
    blurb: 'Many variations of meals of Lorem Ipsum available the majority.',
  },
  {
    day: 'Wednesday',
    img: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=800&auto=format&fit=crop',
    blurb: 'Many variations of meals of Lorem Ipsum available the majority.',
  },
  {
    day: 'Thursday',
    img: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=800&auto=format&fit=crop',
    blurb: 'Many variations of meals of Lorem Ipsum available the majority.',
  },
  {
    day: 'Friday',
    img: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?q=80&w=800&auto=format&fit=crop',
    blurb: 'Many variations of meals of Lorem Ipsum available the majority.',
  },
];

// ── Vending Locator Sidebar ───────────────────────────────────────────────────
const VendingLocatorSidebar = ({
  visible,
  onClose,
  vendingLocations,
  status,
  selectedLocation,
  onLocationSelect,
}: {
  visible:          boolean;
  onClose:          () => void;
  vendingLocations: any[];
  status:           string;
  selectedLocation: any;
  onLocationSelect: (loc: any) => void;
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView]   = useState<'list' | 'map'>('list');

  const filtered = vendingLocations
    .filter((loc: any) =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.info.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a: any, b: any) => {
      if (selectedLocation?.id === a.id) return -1;
      if (selectedLocation?.id === b.id) return 1;
      return 0;
    });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={sidebarStyles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Sidebar panel — slides from right */}
        <MotiView
          from={{ translateX: SCREEN_W }}
          animate={{ translateX: 0 }}
          exit={{ translateX: SCREEN_W }}
          transition={{ type: 'spring', stiffness: 250, damping: 30 }}
          style={sidebarStyles.panel}>

          {/* Header */}
          <View style={sidebarStyles.header}>
            <Text style={sidebarStyles.headerTitle}>Vending Locator</Text>
            <TouchableOpacity
              style={sidebarStyles.closeBtn}
              onPress={onClose}>
              <X size={20} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* Search input */}
          <View style={sidebarStyles.searchRow}>
            <View style={sidebarStyles.searchBox}>
              <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={sidebarStyles.searchInput}
                placeholder="Search by city or street name"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* List/Map toggle */}
          <View style={sidebarStyles.toggleRow}>
            <View style={sidebarStyles.toggleContainer}>
              {(['list', 'map'] as const).map((view) => (
                <TouchableOpacity
                  key={view}
                  style={[
                    sidebarStyles.toggleBtn,
                    activeView === view && sidebarStyles.toggleBtnActive,
                  ]}
                  onPress={() => setActiveView(view)}>
                  <Text
                    style={[
                      sidebarStyles.toggleText,
                      activeView === view && sidebarStyles.toggleTextActive,
                    ]}>
                    {view === 'list' ? 'List View' : 'Map View'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* List content */}
          {activeView === 'list' && (
            <ScrollView
              style={sidebarStyles.listScroll}
              contentContainerStyle={sidebarStyles.listContent}>
              {status === 'loading' ? (
                <ActivityIndicator color={Colors.primary} size="large" />
              ) : (
                filtered.map((location: any) => (
                  <View key={location.id} style={sidebarStyles.locationCard}>
                    {/* Selected badge */}
                    {selectedLocation?.id === location.id && (
                      <View style={sidebarStyles.selectedBadge}>
                        <Text style={sidebarStyles.selectedBadgeText}>
                          Selected Location
                        </Text>
                      </View>
                    )}
                    <Text style={sidebarStyles.locationName}>
                      {location.name}
                    </Text>
                    <Text style={sidebarStyles.locationInfo}>
                      {location.info}
                    </Text>
                    {location.hours && (
                      <Text style={sidebarStyles.locationInfo}>
                        {location.hours}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={sidebarStyles.selectBtn}
                      onPress={() => onLocationSelect(location)}>
                      <Text style={sidebarStyles.selectBtnText}>
                        {selectedLocation?.id === location.id
                          ? 'Selected'
                          : 'Select This Location'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          {/* Map view placeholder */}
          {activeView === 'map' && (
            <View style={sidebarStyles.mapPlaceholder}>
              <Text style={{ color: Colors.neutralGray, textAlign: 'center' }}>
                Map view requires Google Maps native key configuration.{'\n'}
                Use List view to select a location.
              </Text>
            </View>
          )}
        </MotiView>
      </View>
    </Modal>
  );
};

// ── HeroSection (vending) ─────────────────────────────────────────────────────
const VendingHeroSection = () => {
  const navigation       = useNavigation<any>();
  const dispatch         = useDispatch();
  const vendingLocations = useSelector(selectAllLocations);
  const status           = useSelector(getLocationsStatus);
  const userData         = useSelector((state: any) => state?.user?.user);

  const [sidebarVisible, setSidebarVisible]   = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  useEffect(() => {
    if (status === 'idle') dispatch(fetchLocations() as any);
  }, [status, dispatch]);

  useEffect(() => {
    getSelectedLocation().then((stored) => {
      if (stored) setSelectedLocation(stored.location);
    });
  }, []);

  const handleLocationSelect = async (location: any) => {
    setSelectedLocation(location);
    const userId = userData?.id || null;
    await persistLocation({ userId, location });
  };

  return (
    <>
      <View style={heroStyles.container}>
        {/* bg-cover bg-center h-[512px] */}
        <Image
          source={require('@/assets/images/vending_home/hero-vending.png')}
          style={heroStyles.bgImage}
          contentFit="cover"
        />
        {/* Dark overlay md:bg-black/30 */}
        <View style={heroStyles.overlay} />

        {/* Centered white card */}
        <View style={heroStyles.cardWrap}>
          <View style={heroStyles.card}>
            {/* h1 text-[40px] font-extrabold text-[#054A86] */}
            <Text style={heroStyles.cardTitle}>Meals on Your Schedule</Text>

            {/* p text-[20px] font-semibold text-[#545563] */}
            <Text style={heroStyles.cardSubtitle}>
              Plan and reserve your meal and pick it up from a vending location nearby.
            </Text>

            {/* Search input — opens sidebar on press */}
            <TouchableOpacity
              style={heroStyles.searchBtn}
              onPress={() => setSidebarVisible(true)}>
              <TextInput
                style={heroStyles.searchInput}
                placeholder="Find nearby vending locations…"
                placeholderTextColor={Colors.neutralGrayDark}
                editable={false}
                pointerEvents="none"
              />
              <Search size={17} color={Colors.neutralBlack} style={heroStyles.searchIcon} />
            </TouchableOpacity>

            {/* "Or browse our vending meals" link */}
            <TouchableOpacity
              style={{ alignSelf: 'center', marginTop: 24 }}
              onPress={() => navigation.navigate('VendingMenu')}>
              <Text style={heroStyles.browseLink}>
                Or browse our vending meals
              </Text>
            </TouchableOpacity>

            {/* meal browse image */}
            <Image
              source={require('@/assets/images/vending_home/meal_browes.png')}
              style={heroStyles.mealBrowse}
              contentFit="contain"
            />
          </View>
        </View>
      </View>

      {/* Vending Locator Sidebar */}
      <VendingLocatorSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        vendingLocations={vendingLocations}
        status={status}
        selectedLocation={selectedLocation}
        onLocationSelect={(loc) => {
          handleLocationSelect(loc);
          setSidebarVisible(false);
        }}
      />
    </>
  );
};

// ── Day Meal Carousel (SliderSection) ────────────────────────────────────────
const SliderSection = () => {
  const navigation  = useNavigation<any>();
  const carouselRef = useRef<any>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <View style={sliderStyles.section}>
      <Text style={sliderStyles.sectionTitle}>Weekly Meal Preview</Text>

      <Carousel
        ref={carouselRef}
        width={SCREEN_W - 32}
        height={300}
        loop
        data={DAY_SLIDES}
        scrollAnimationDuration={600}
        onSnapToItem={setActiveIdx}
        style={{ marginHorizontal: 16 }}
        renderItem={({ item }) => (
          <View style={sliderStyles.slide}>
            <Image
              source={{ uri: item.img }}
              style={sliderStyles.slideImg}
              contentFit="cover"
            />
            <View style={sliderStyles.slideOverlay} />
            <View style={sliderStyles.slideContent}>
              <Text style={sliderStyles.dayLabel}>{item.day}</Text>
              <Text style={sliderStyles.blurb}>{item.blurb}</Text>
            </View>
          </View>
        )}
      />

      {/* Arrows */}
      <View style={sliderStyles.arrows}>
        <TouchableOpacity
          style={sliderStyles.arrowBtn}
          onPress={() => carouselRef.current?.prev()}>
          <ChevronLeft size={14} color={Colors.neutralBlack} />
        </TouchableOpacity>
        <TouchableOpacity
          style={sliderStyles.arrowBtn}
          onPress={() => carouselRef.current?.next()}>
          <ChevronRight size={14} color={Colors.neutralBlack} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={sliderStyles.viewMenuBtn}
        onPress={() => navigation.navigate('VendingMenu')}>
        <Text style={sliderStyles.viewMenuText}>View Full Menu</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── GetApp Section ────────────────────────────────────────────────────────────
const GetApp = () => (
  <View style={getAppStyles.section}>
    <Text style={getAppStyles.title}>Get the Dosta App</Text>
    <Text style={getAppStyles.subtitle}>
      Manage your deliveries from anywhere, anytime.
    </Text>
    <View style={getAppStyles.badges}>
      <Image
        source={{ uri: 'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg' }}
        style={getAppStyles.badge}
        contentFit="contain"
      />
      <Image
        source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg' }}
        style={getAppStyles.badge}
        contentFit="contain"
      />
    </View>
  </View>
);

// ── Newsletter (same as Home) ─────────────────────────────────────────────────
const Newsletter = () => {
  const [email, setEmail] = useState('');
  return (
    <View style={nlStyles.wrap}>
      <Text style={nlStyles.title}>Subscribe for exclusive offers</Text>
      <Text style={nlStyles.subtitle}>
        Subscribe to our emails and get the latest product offers and more.
      </Text>
      <View style={nlStyles.row}>
        <TextInput
          style={nlStyles.input}
          placeholder="Email"
          placeholderTextColor={Colors.neutralGray}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity style={nlStyles.btn}>
          <Text style={nlStyles.btnText}>Subscribe</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function VendingHomeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: Colors.neutralWhite, paddingTop: insets.top }}>
      <Header />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}>
        <VendingHeroSection />
        <SliderSection />
        <GetApp />
        <Newsletter />
        <Footer />
      </ScrollView>
      <MobileFooterNav />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const heroStyles = StyleSheet.create({
  container: {
    height: 460,
    position: 'relative',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 585,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 32,
    shadowColor: '#2B2B43',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  cardSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutralGrayDark,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutralGrayDark,
  },
  searchIcon: {
    marginLeft: -8,
  },
  browseLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryBlue,
  },
  mealBrowse: {
    width: '100%',
    height: 60,
    marginTop: 24,
  },
});

const sidebarStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  panel: {
    width: Math.min(SCREEN_W, 522),
    height: SCREEN_H,
    backgroundColor: Colors.neutralWhite,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  searchRow: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.neutralDark,
  },
  toggleRow: {
    paddingHorizontal: 32,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  toggleTextActive: {
    color: Colors.neutralWhite,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 32,
    paddingVertical: 32,
    gap: 16,
  },
  locationCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  selectedBadge: {
    backgroundColor: Colors.green,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  locationName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  locationInfo: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 4,
  },
  selectBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  selectBtnText: {
    fontSize: 14,
    color: Colors.neutralDark,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});

const sliderStyles = StyleSheet.create({
  section: {
    paddingTop: 48,
    paddingBottom: 48,
    backgroundColor: Colors.neutralWhite,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  slide: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 300,
    position: 'relative',
  },
  slideImg: {
    ...StyleSheet.absoluteFillObject,
  },
  slideOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  slideContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
  },
  dayLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.neutralWhite,
    marginBottom: 8,
  },
  blurb: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  arrows: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingRight: 16,
    marginTop: 12,
  },
  arrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: Colors.neutralBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMenuBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewMenuText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
});

const getAppStyles = StyleSheet.create({
  section: {
    backgroundColor: Colors.background,
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.neutralGrayDark,
    marginBottom: 16,
  },
  badges: {
    flexDirection: 'row',
    gap: 12,
  },
  badge: {
    height: 40,
    width: 130,
  },
});

const nlStyles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.neutralGrayLightest,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.neutralGrayDark,
    textAlign: 'center',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLight,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: Colors.neutralWhite,
    color: Colors.neutralBlack,
  },
  btn: {
    backgroundColor: Colors.secondary,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
});
