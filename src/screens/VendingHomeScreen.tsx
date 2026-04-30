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
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, Search, Send } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Carousel from '@/components/ui/Carousel';
import AnimateOnScroll from '@/components/ui/AnimateOnScroll';
import { useDispatch, useSelector } from 'react-redux';
import { MotiView } from 'moti';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
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

const { width: SCREEN_W } = Dimensions.get('window');

// Fallback vending locations with Dubai coordinates (mirrors web VendingMap.tsx)
const FALLBACK_VENDING_LOCATIONS = [
  { id: 1, name: 'Barsha 1',       position: { lat: 25.118, lng: 55.201 }, info: 'Near Mall of the Emirates, St. 12', hours: 'Open - Closes at 10 PM' },
  { id: 2, name: 'JLT Cluster D',  position: { lat: 25.073, lng: 55.141 }, info: 'Beside Carrefour Market',           hours: 'Open 24 Hours' },
  { id: 3, name: 'Business Bay',   position: { lat: 25.189, lng: 55.273 }, info: 'Close to Bay Avenue Mall',          hours: 'Open - Closes at 9 PM' },
];

const MAP_CENTER = { latitude: 25.118, longitude: 55.201 };

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
// Faithful port of web Dosta/src/components/vending_home/HeroSection.tsx sidebar:
//   - Slide-in from right, full screen height (incl. safe areas)
//   - Header (smaller text on mobile per web), close button
//   - Search input with adjacent send button (paper-airplane)
//   - List/Map toggle pills
//   - Location list cards with "Selected Location" badge
//   - Sticky footer "Confirm & Close" — disabled until a location is picked,
//     navigates to OrderNow when pressed (web routes to /vending-home/order-now)
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
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView]   = useState<'list' | 'map'>('list');
  const mapRef = useRef<MapView>(null);

  // Locations for the map — prefer store data that has coordinates, else use fallback
  const mapLocations: any[] = (
    vendingLocations.filter((l: any) => l?.position?.lat && l?.position?.lng).length
      ? vendingLocations
      : FALLBACK_VENDING_LOCATIONS
  );

  // Pan map to selected location whenever it changes while map is visible
  useEffect(() => {
    if (activeView === 'map' && selectedLocation?.position) {
      mapRef.current?.animateToRegion({
        latitude:  selectedLocation.position.lat,
        longitude: selectedLocation.position.lng,
        latitudeDelta:  0.05,
        longitudeDelta: 0.05,
      }, 600);
    }
  }, [selectedLocation, activeView]);

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

  const handleConfirm = () => {
    if (!selectedLocation) return;
    onClose();
    navigation.navigate('OrderNow');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={sidebarStyles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* Wrapper handles positioning (top: 0 → bottom: 0 along the right
            edge) so the inner MotiView only handles the slide animation.
            Decoupling these makes the layout deterministic — MotiView's
            flex behaviour can be flaky when also doing transform animations. */}
        <View style={sidebarStyles.panelWrap} pointerEvents="box-none">
          <MotiView
            from={{ translateX: SCREEN_W }}
            animate={{ translateX: 0 }}
            exit={{ translateX: SCREEN_W }}
            transition={{ type: 'spring', stiffness: 250, damping: 30 }}
            style={[
              sidebarStyles.panel,
              { paddingTop: insets.top },
            ]}>

          {/* Header — web: text-[20px] font-[600] mobile, py-[18px] px-[15px] */}
          <View style={sidebarStyles.header}>
            <Text style={sidebarStyles.headerTitle}>Vending Locator</Text>
            <TouchableOpacity
              style={sidebarStyles.closeBtn}
              onPress={onClose}>
              <X size={20} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* Search input + send button (paper-airplane), matches web layout */}
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
            <TouchableOpacity style={sidebarStyles.sendBtn} activeOpacity={0.7}>
              <Send size={16} color={Colors.neutralBlack} />
            </TouchableOpacity>
          </View>

          {/* List/Map toggle */}
          <View style={sidebarStyles.toggleRow}>
            <View style={sidebarStyles.toggleContainer}>
              {(['list', 'map'] as const).map((view) => (
                <TouchableOpacity
                  key={view}
                  activeOpacity={0.85}
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

          {/* List content — flex:1 so it scrolls between toggle and footer */}
          {activeView === 'list' && (
            <ScrollView
              style={sidebarStyles.listScroll}
              contentContainerStyle={sidebarStyles.listContent}
              showsVerticalScrollIndicator={false}>
              {status === 'loading' ? (
                <ActivityIndicator color={Colors.primary} size="large" />
              ) : (
                filtered.map((location: any) => {
                  const isSelected = selectedLocation?.id === location.id;
                  return (
                    <View key={location.id} style={sidebarStyles.locationCard}>
                      {isSelected && (
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
                        <Text style={sidebarStyles.locationHours}>
                          {location.hours}
                        </Text>
                      )}
                      <TouchableOpacity
                        style={sidebarStyles.selectBtn}
                        onPress={() => onLocationSelect(location)}>
                        <Text style={sidebarStyles.selectBtnText}>
                          {isSelected ? 'Selected' : 'Select This Location'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Map view — mirrors web VendingMap.tsx */}
          {activeView === 'map' && (
            <View style={sidebarStyles.mapContainer}>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  ...MAP_CENTER,
                  latitudeDelta:  0.8,
                  longitudeDelta: 0.8,
                }}
                showsUserLocation={false}
                toolbarEnabled={false}
                onMapReady={() => {
                  if (mapLocations.length > 0) {
                    mapRef.current?.fitToCoordinates(
                      mapLocations.map((l: any) => ({
                        latitude:  l.position.lat,
                        longitude: l.position.lng,
                      })),
                      { edgePadding: { top: 60, right: 40, bottom: 60, left: 40 }, animated: true },
                    );
                  }
                }}
              >
                {mapLocations.map((loc: any) => {
                  const isSelected = selectedLocation?.id === loc.id;
                  return (
                    <Marker
                      key={loc.id}
                      coordinate={{
                        latitude:  loc.position.lat,
                        longitude: loc.position.lng,
                      }}
                      onPress={() => onLocationSelect(loc)}
                      pinColor={isSelected ? Colors.secondaryRed : Colors.primary}
                    >
                      <Callout tooltip>
                        <View style={sidebarStyles.callout}>
                          <View style={sidebarStyles.calloutBadge}>
                            <Text style={sidebarStyles.calloutBadgeText}>
                              {isSelected ? 'SELECTED LOCATION' : loc.name.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={sidebarStyles.calloutName}>{loc.name}</Text>
                          <Text style={sidebarStyles.calloutInfo}>{loc.info}</Text>
                          {loc.hours ? (
                            <Text style={sidebarStyles.calloutHours}>{loc.hours}</Text>
                          ) : null}
                        </View>
                      </Callout>
                    </Marker>
                  );
                })}
              </MapView>
            </View>
          )}

          {/* Footer — sticky "Confirm & Close" button. On Android the Modal
              stops above the nav bar, so insets.bottom would double-count.
              Use Math.max so iOS still clears the home indicator (~34px)
              while Android stays a clean 16px from the panel edge. */}
          <View
            style={[
              sidebarStyles.footer,
              { paddingBottom: 16 },
            ]}>
            <TouchableOpacity
              style={[
                sidebarStyles.confirmBtn,
                !selectedLocation && sidebarStyles.confirmBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedLocation}
              activeOpacity={0.85}>
              <Text style={sidebarStyles.confirmBtnText}>Confirm & Close</Text>
            </TouchableOpacity>
          </View>
        </MotiView>
        </View>
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
        onLocationSelect={handleLocationSelect}
      />
    </>
  );
};

// ── Day Meal Carousel (SliderSection) ────────────────────────────────────────
// Faithful port of web Dosta/src/components/vending_home/SliderSection.tsx:
//  - Heading: "Explore Our Daily Menu" with embedded "View our complete menu" link
//  - 5 day slides (Mon–Fri), each tappable → /vending-home/menu (VendingMenu)
//  - Each slide: image bg + bottom-weighted dark gradient + day h3 + blurb
//  - Dots below; selected dot is wider (matches web w-6 vs w-2.5)
//  - Arrows are hidden on mobile in the web ("hidden md:block"), so we omit them
const SliderSection = () => {
  const navigation  = useNavigation<any>();
  const carouselRef = useRef<any>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const goToMenu = () => navigation.navigate('VendingMenu');

  return (
    <View style={sliderStyles.section}>
      <AnimateOnScroll>
        <View style={sliderStyles.headWrap}>
          {/* h2 text-[28px] leading-[36px] font-bold text-[#032F55] */}
          <Text style={sliderStyles.sectionTitle}>Explore Our Daily Menu</Text>
          {/* p text-base font-[700] (mobile) text-[#032F55] with embedded link */}
          <Text style={sliderStyles.sectionSubtitle}>
            Daily menu of 13 chef-prepared meals, available Monday to Friday.{' '}
            <Text style={sliderStyles.subtitleLink} onPress={goToMenu}>
              View our complete menu
            </Text>
          </Text>
        </View>
      </AnimateOnScroll>

      <AnimateOnScroll delay={150}>
        <Carousel
          ref={carouselRef}
          width={SCREEN_W - 32}
          height={256}
          loop
          data={DAY_SLIDES}
          scrollAnimationDuration={600}
          onSnapToItem={setActiveIdx}
          style={{ marginHorizontal: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={goToMenu}
              style={sliderStyles.slideTouch}>
              <View style={sliderStyles.slide}>
                <Image
                  source={{ uri: item.img }}
                  style={sliderStyles.slideImg}
                  contentFit="cover"
                />
                {/* bg-gradient-to-t from-black/65 via-black/25 to-transparent */}
                <LinearGradient
                  colors={[
                    'rgba(0,0,0,0)',
                    'rgba(0,0,0,0.25)',
                    'rgba(0,0,0,0.65)',
                  ]}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={sliderStyles.slideContent}>
                  {/* h3 text-xl font-semibold drop-shadow */}
                  <Text style={sliderStyles.dayLabel}>{item.day}</Text>
                  {/* p text-[11px] leading-snug opacity-85 mt-1 */}
                  <Text style={sliderStyles.blurb}>{item.blurb}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </AnimateOnScroll>

      {/* Dots — selected w-6 bg-black/80, unselected w-2.5 bg-black/30 */}
      <View style={sliderStyles.dotsRow}>
        {DAY_SLIDES.map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => carouselRef.current?.scrollTo(i)}
            style={[sliderStyles.dot, i === activeIdx && sliderStyles.dotActive]}
            accessibilityLabel="Go to slide"
          />
        ))}
      </View>
    </View>
  );
};


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
      <Header variant="vending" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}>
        <VendingHeroSection />
        <SliderSection />
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
    // minHeight (not height) — lets the container grow if the title wraps to
    // 2 lines on narrow phones instead of clipping the card.
    minHeight: 480,
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
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 585,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#2B2B43',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 32,
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutralGrayDark,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: Colors.neutralGrayDark,
    paddingVertical: 0,             // kill Android default vertical padding
    includeFontPadding: false,      // kill Android baseline padding
    textAlignVertical: 'center',
  },
  searchIcon: {
    marginLeft: 8,
  },
  browseLink: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryBlue,
  },
  mealBrowse: {
    width: '100%',
    height: 48,
    marginTop: 16,
  },
});

const sidebarStyles = StyleSheet.create({
  // backdrop is row-flex so the panel pushes to the right edge; default
  // alignItems: stretch makes the panel fill vertically without a fixed height.
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  // Wrapper anchors to the right edge of the modal, top:0 → bottom:0, with
  // the configured panel width. Carries no animation — purely positioning.
  panelWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: Math.min(SCREEN_W, 522),
  },
  // Panel fills the wrapper. MotiView animates translateX on top of this.
  panel: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.neutralWhite,
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  // Web mobile header: py-[18px] px-[15px], title text-[20px] leading-[28px] font-[600]
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: '#111827',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  // Search row — input + send (paper-airplane) button. Web: px-8 py-4 gap-2.
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchBox: {
    flex: 1,
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
    paddingVertical: 0,           // kill Android default padding
    includeFontPadding: false,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.neutralGrayLightest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    backgroundColor: Colors.neutralWhite,
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
    backgroundColor: 'transparent',
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
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: Colors.green,        // bg-[#A7CF38]
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,                // text-[#054A86]
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
  },
  locationHours: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 4,                         // web: mt-1
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
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  // InfoWindow equivalent — mirrors web VendingMap InfoWindow div
  callout: {
    width: 260,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#2B2B43',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  calloutBadge: {
    backgroundColor: Colors.green,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
  },
  calloutBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  calloutName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  calloutInfo: {
    fontSize: 13,
    color: '#4B5563',
  },
  calloutHours: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 4,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  // Sticky footer — Confirm & Close button. Web: bg-white p-4 full-width.
  footer: {
    backgroundColor: Colors.neutralWhite,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  confirmBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,                      // web: rounded-lg
    backgroundColor: Colors.primary,      // bg-[#054A86]
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#9CA3AF',           // web: bg-gray-400
  },
  confirmBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '500',
    fontSize: 15,
  },
});

const sliderStyles = StyleSheet.create({
  // section: web `main-container` + py-12 (48px). On mobile we tighten slightly.
  section: {
    paddingTop: 32,
    paddingBottom: 32,
    backgroundColor: Colors.neutralWhite,
  },
  // header block — centered, gap-2 between title and subtitle (mb-8 below)
  headWrap: {
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  // h2 text-[28px] leading-[36px] font-bold text-[#032F55]
  sectionTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: '#032F55',
    textAlign: 'center',
    marginBottom: 8,
  },
  // p text-base font-[700] text-[#032F55] (mobile bold per web max-md rule)
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#032F55',
    textAlign: 'center',
  },
  // <Link className="underline text-[#056AC1]">
  subtitleLink: {
    color: '#056AC1',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  // each slide is wrapped in a TouchableOpacity for the click → /vending-home/menu
  slideTouch: {
    flex: 1,
  },
  // .group h-64 w-full overflow-hidden rounded-2xl shadow
  slide: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  slideImg: {
    ...StyleSheet.absoluteFillObject,
  },
  // .absolute bottom-0 left-0 right-0 p-4 text-white
  slideContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
  },
  // h3 text-xl font-semibold drop-shadow
  dayLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutralWhite,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // p text-[11px] leading-snug opacity-85 mt-1
  blurb: {
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  // .mt-4 flex items-center justify-center gap-2
  dotsRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // unselected dot — h-2.5 w-2.5 rounded-full bg-black/30
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  // selected dot — h-2.5 w-6 rounded-full bg-black/80
  dotActive: {
    width: 24,
    backgroundColor: 'rgba(0,0,0,0.8)',
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
