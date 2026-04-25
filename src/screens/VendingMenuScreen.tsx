/**
 * VendingMenuScreen — faithful translation of web pages/VendingMenu.tsx
 *
 * Web structure (preserved exactly):
 *   Header (sticky top-[64px])
 *   BreadCrumb + h2 "Vending Menu" text-[28px] text-[#054A86] font-[700]
 *   Sticky sub-header (when scrolled):
 *     "Browse our daily menu of N chef-prepared meals" text-[24px]
 *     "Start Your Order" button bg-[#054A86]
 *     Day tabs Mon–Fri:
 *       active:   h-[56px] bg-[#EAF5FF] border-2 border-[#054A86] rounded-[16px]
 *       inactive: bg-white border border-[#C7C8D2] rounded-[16px]
 *       max-w-[212px] (desktop), full-width scroll on mobile
 *   Item grid: flex flex-wrap gap-[24px]
 *     MenuItemCard: max-w-[354px] rounded-[16px] border-[#EDEEF2]
 *       ImageWithShimmer h-[180px]
 *       SOLD OUT / LOCKED overlay badges
 *       "Only N left" orange badge top-4 right-4
 *       name text-[24px] font-[700] text-[#2B2B43]
 *       description text-[14px] line-clamp-2 text-[#83859C]
 *       "AED {price}" text-[16px] font-[700]
 *   Slide-in detail panel (right):
 *     bg-white max-w-[522px]
 *     name text-[28px] font-[700]
 *     image h-[343px]
 *     description, price
 *     "Buy one get one for free"
 *     "Terms & conditions Apply" link
 *     [Close] outline | [Start Your Order] bg-[#054A86]
 *   If shelfData: shelves with spot labels
 *   MobileFooterNav, Footer
 *   AuthPromptModal
 *
 * Logic preserved exactly from web (all API calls, stock logic, etc.)
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useSelector } from 'react-redux';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import BreadCrumb from '@/components/ui/BreadCrumb';
import Shimmer from '@/components/ui/Shimmer';
import AuthPromptModal from '@/components/common/AuthPromptModal';
import {
  getAuthToken,
  getSelectedLocation,
  getMachineGoodsCache,
  setMachineGoodsCache,
  getOrderData,
} from '@/utils/storage';
import { BASE_URL } from '@/services/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const normalizeName = (name: string) =>
  (name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

// ── MenuItemCard — exact translation of web MenuItemCard ─────────────────────
const MenuItemCard = ({
  data,
  onClick,
  quantity,
}: {
  data: any;
  onClick: () => void;
  quantity?: number;
}) => {
  const isSoldOut = quantity !== undefined && quantity <= 0;
  const isLocked  = data.locked || false;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        (isSoldOut || isLocked) && styles.cardDimmed,
      ]}
      onPress={isLocked ? undefined : onClick}
      disabled={isLocked}
      activeOpacity={0.85}>
      {/* Image — h-[180px] */}
      <View style={styles.cardImageWrap}>
        <Image
          source={{ uri: data.image_url || 'https://placehold.co/354x180' }}
          style={styles.cardImage}
          contentFit="cover"
          placeholder={{ color: Colors.neutralGrayLightest }}
          transition={300}
        />

        {/* LOCKED badge */}
        {isLocked && (
          <View style={styles.overlayBadge}>
            <View style={[styles.badge, { backgroundColor: Colors.orange }]}>
              <Text style={styles.badgeText}>LOCKED</Text>
            </View>
          </View>
        )}

        {/* SOLD OUT badge */}
        {!isLocked && isSoldOut && (
          <View style={styles.overlayBadge}>
            <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.badgeText}>SOLD OUT</Text>
            </View>
          </View>
        )}

        {/* Only N left badge — top-4 right-4 */}
        {quantity !== undefined && !isSoldOut && !isLocked && quantity < 5 && (
          <View style={styles.stockBadge}>
            <Text style={styles.stockBadgeText}>Only {quantity} left</Text>
          </View>
        )}
      </View>

      {/* Card content */}
      <View style={styles.cardContent}>
        {/* name text-[24px] font-[700] text-[#2B2B43] */}
        <Text style={styles.cardName} numberOfLines={2}>{data.name}</Text>
        {/* description text-[14px] line-clamp-2 text-[#83859C] */}
        <Text style={styles.cardDesc} numberOfLines={2}>{data.description}</Text>
        {/* price text-[16px] font-[700] */}
        <Text style={styles.cardPrice}>AED {data.price}</Text>
      </View>
    </TouchableOpacity>
  );
};

// ── Item Detail Slide-in ──────────────────────────────────────────────────────
const ItemDetailSheet = ({
  item,
  onClose,
  onOrder,
}: {
  item: any;
  onClose: () => void;
  onOrder: () => void;
}) => {
  if (!item) return null;
  return (
    <Modal
      visible={!!item}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <View style={sheetStyles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <MotiView
          from={{ translateX: SCREEN_W }}
          animate={{ translateX: 0 }}
          transition={{ type: 'spring', stiffness: 250, damping: 30 }}
          style={sheetStyles.panel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header: name + X */}
            <View style={sheetStyles.header}>
              <Text style={sheetStyles.name} numberOfLines={2}>
                {item.name}
              </Text>
              <TouchableOpacity
                style={sheetStyles.closeBtn}
                onPress={onClose}>
                <X size={20} color={Colors.neutralBlack} />
              </TouchableOpacity>
            </View>

            {/* Image h-[343px] */}
            <Image
              source={{ uri: item.image_url }}
              style={sheetStyles.image}
              contentFit="cover"
            />

            {/* Details */}
            <View style={sheetStyles.details}>
              <Text style={sheetStyles.description}>{item.description}</Text>
              <Text style={sheetStyles.price}>{item.price}</Text>
              <Text style={sheetStyles.offer}>Buy one get one for free</Text>
              <Text
                style={sheetStyles.termsLink}
                onPress={() => {}}>
                Terms & conditions Apply
              </Text>
            </View>

            {/* Actions */}
            <View style={sheetStyles.actions}>
              <TouchableOpacity
                style={sheetStyles.closeAction}
                onPress={onClose}>
                <Text style={sheetStyles.closeActionText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={sheetStyles.orderBtn}
                onPress={onOrder}>
                <Text style={sheetStyles.orderBtnText}>Start Your Order</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </MotiView>
      </View>
    </Modal>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function VendingMenuScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const userData   = useSelector((state: any) => state?.user?.user);

  const [tab,           setTab]           = useState(0);
  const [weeklyMenu,    setWeeklyMenu]    = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [machineGoods,  setMachineGoods]  = useState<any[] | null>(null);
  const [machineShelves,setMachineShelves]= useState<any[] | null>(null);
  const [selectedItem,  setSelectedItem]  = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Fetch weekly menu — exact from web
  useEffect(() => {
    const fetchWeeklyMenu = async () => {
      setLoading(true);
      try {
        const authToken = await getAuthToken();
        const headers: any = {};
        if (authToken) headers['Authorization'] = `Token ${authToken}`;
        const res = await fetch(`${BASE_URL}/api/vending/menu/plan/WEEKLY/`, {
          method: 'GET',
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          setWeeklyMenu(data.week_menu);
        }
      } catch (err) {
        console.error('Error fetching weekly menu:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWeeklyMenu();
  }, []);

  // Fetch machine goods — exact from web
  useEffect(() => {
    const fetchMachineGoods = async () => {
      try {
        const selectedLocation = await getSelectedLocation();
        const serialNumber = selectedLocation?.location?.serial_number;
        if (!serialNumber) { setMachineGoods([]); return; }

        const cached = await getMachineGoodsCache(serialNumber);
        if (cached) {
          const { goods, shelves, timestamp } = cached;
          const isExpired = Date.now() - timestamp > 5 * 60 * 1000;
          if (goods && goods.length > 0) {
            setMachineGoods(goods);
            if (shelves) setMachineShelves(shelves);
            if (!isExpired) return;
          }
        }

        const res = await fetch(
          `${BASE_URL}/api/vending/external/machine-goods/?machineUuid=${serialNumber}`,
        );
        const data = await res.json();
        if (data?.data) {
          const allGoods = data.data.flatMap((cat: any) => cat.goodsList || []);
          setMachineGoods(allGoods);
          if (data.shelves) setMachineShelves(data.shelves);
          await setMachineGoodsCache(serialNumber, {
            goods: allGoods,
            shelves: data.shelves || null,
            timestamp: Date.now(),
          });
        } else {
          setMachineGoods([]);
        }
      } catch {
        setMachineGoods([]);
      }
    };
    fetchMachineGoods();
  }, []);

  // Computed items — identical logic to web
  const { currentDayItems, shelfData, totalAvailableCount } = useMemo(() => {
    if (!weeklyMenu)
      return { currentDayItems: [], shelfData: [], totalAvailableCount: 0 };

    const selectedDayName = DAYS[tab];
    const dayData  = weeklyMenu[selectedDayName];
    const items    = dayData?.items || [];
    const today    = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    if (selectedDayName === today && machineShelves) {
      const itemLookup = new Map<string, any>();
      items.forEach((item: any) => itemLookup.set(normalizeName(item.name), item));

      const processedShelves = machineShelves
        .map((shelf: any) => ({
          ...shelf,
          spots: shelf.spots
            .map((spot: any) => {
              if (!spot.goods) return { ...spot, enrichedItem: null };
              const menuItem = itemLookup.get(normalizeName(spot.goods.goodsName));
              if (menuItem) {
                return {
                  ...spot,
                  enrichedItem: {
                    ...menuItem,
                    vendingGoodUuid: spot.goods.uuid,
                    price: parseFloat(spot.goods.goodsPrice).toFixed(2),
                    image_url: menuItem.image_url || '',
                    locked: spot.goods.locked || false,
                  },
                };
              }
              return { ...spot, enrichedItem: null };
            })
            .filter((spot: any) => spot.enrichedItem !== null),
        }))
        .filter((shelf: any) => shelf.spots.length > 0);

      const totalAvailableCount = processedShelves.reduce(
        (acc: number, shelf: any) => acc + shelf.spots.length, 0,
      );
      return { currentDayItems: [], shelfData: processedShelves, totalAvailableCount };
    }

    return { currentDayItems: items, shelfData: [], totalAvailableCount: items.length };
  }, [weeklyMenu, tab, machineShelves]);

  // startOrder — exact from web
  const startOrder = useCallback(async () => {
    if (!selectedItem) return;
    const authToken = await getAuthToken();
    if (!authToken) { setShowAuthModal(true); return; }

    try {
      const headers: any = {
        'Content-Type': 'application/json',
        Authorization: `Token ${authToken}`,
      };

      let existingItems: any[] = [];
      let locationId = 1;

      try {
        const cartRes = await fetch(`${BASE_URL}/api/vending/cart/`, { headers });
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          locationId = cartData.location?.id || 1;
          existingItems = (cartData.items || []).filter(
            (i: any) => i.plan_type === 'ORDER_NOW',
          );
        } else {
          const loc = await getSelectedLocation();
          locationId = Number(loc?.location?.id) || 1;
        }
      } catch {
        const loc = await getSelectedLocation();
        locationId = loc?.location?.id || 1;
      }

      // Calculate stock (identical to web)
      let totalAvailable = 0;
      if (shelfData && shelfData.length > 0) {
        shelfData.forEach((shelf: any) => {
          shelf.spots.forEach((spot: any) => {
            if (
              spot.enrichedItem &&
              normalizeName(spot.enrichedItem.name) === normalizeName(selectedItem.name) &&
              !spot.goods?.locked
            ) {
              totalAvailable += spot.presentNumber;
            }
          });
        });
      } else if (machineGoods) {
        machineGoods.forEach((good: any) => {
          const rawName = typeof good === 'string' ? good : good?.goodsName || '';
          if (normalizeName(rawName) === normalizeName(selectedItem.name) && !good?.locked) {
            totalAvailable += good.presentNumber || 1;
          }
        });
      }

      let updatedItems = existingItems.map((i: any) => ({
        menu_item_id:     i.menu_item.id,
        quantity:         i.quantity,
        day_of_week:      null,
        week_number:      null,
        vending_good_uuid:i.vending_good_uuid,
      }));

      const existingIndex = updatedItems.findIndex(
        (i: any) => i.menu_item_id === selectedItem.id,
      );

      if (existingIndex >= 0) {
        if (updatedItems[existingIndex].quantity < totalAvailable) {
          updatedItems[existingIndex].quantity += 1;
        } else {
          Alert.alert('Stock Limit', `Only ${totalAvailable} items available.`);
          return;
        }
      } else {
        if (totalAvailable > 0) {
          updatedItems.push({
            menu_item_id:     selectedItem.id,
            quantity:         1,
            day_of_week:      null,
            week_number:      null,
            vending_good_uuid:selectedItem.vendingGoodUuid || null,
          });
        } else {
          Alert.alert('Sold Out', 'This item is sold out.');
          return;
        }
      }

      const payload = {
        location_id: locationId,
        plan_type:   'ORDER_NOW',
        plan_subtype:'NONE',
        items:       updatedItems,
      };

      const postRes = await fetch(`${BASE_URL}/api/vending/cart/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (postRes.ok) {
        setSelectedItem(null);
        navigation.navigate('Cart');
      } else {
        Alert.alert('Error', 'Failed to add item to cart. Please try again.');
      }
    } catch (err) {
      console.error('Error in startOrder:', err);
    }
  }, [selectedItem, shelfData, machineGoods, navigation]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header />

      {/* Breadcrumb + title */}
      <View style={styles.titleArea}>
        <BreadCrumb />
        <Text style={styles.pageTitle}>Vending Menu</Text>
      </View>

      {/* Day tabs (sticky equivalent — inside ScrollView header) */}
      <View style={styles.tabsHeader}>
        {/* Count line */}
        <Text style={styles.countText}>
          Browse our daily menu of {totalAvailableCount} chef-prepared meals
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}>
          {DAYS.map((day, index) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.tab,
                tab === index ? styles.tabActive : styles.tabInactive,
              ]}
              onPress={() => setTab(index)}>
              <Text
                style={[
                  styles.tabText,
                  tab === index && styles.tabTextActive,
                ]}>
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <Shimmer />
        ) : shelfData.length > 0 ? (
          // Shelf/spot layout — exact from web
          <View style={styles.shelvesWrap}>
            {shelfData.map((shelf: any) => (
              <View key={shelf.shelfIndex} style={styles.shelfSection}>
                <View style={styles.shelfHeader}>
                  <View style={styles.shelfAccent} />
                  <Text style={styles.shelfName}>{shelf.shelfName}</Text>
                </View>
                <View style={styles.itemsWrap}>
                  {shelf.spots.map((spot: any, si: number) => {
                    const data = spot.enrichedItem;
                    return (
                      <View key={si} style={styles.spotWrap}>
                        {/* Spot label */}
                        <View style={styles.spotLabel}>
                          <Text style={styles.spotLabelText}>
                            {spot.arrivalName}
                          </Text>
                        </View>
                        <MenuItemCard
                          data={{ ...data, imgAlt: data.name }}
                          quantity={spot.presentNumber}
                          onClick={() => setSelectedItem({ ...data })}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : currentDayItems.length > 0 ? (
          <View style={styles.itemsWrap}>
            {currentDayItems.map((data: any, index: number) => (
              <MenuItemCard
                key={index}
                data={{ ...data, imgAlt: data.name }}
                onClick={() => setSelectedItem({ ...data })}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No items available for {DAYS[tab]}.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Item detail slide-in */}
      <ItemDetailSheet
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onOrder={() => {
          startOrder();
          setSelectedItem(null);
        }}
      />

      <MobileFooterNav />
      <Footer />

      <AuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="Please log in to add items to your cart. Don't have an account? Sign up for free!"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  titleArea: {
    backgroundColor: Colors.neutralWhite,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  pageTitle: {
    fontSize: 28,                  // text-[28px]
    color: Colors.primary,         // text-[#054A86]
    fontWeight: '700',
    letterSpacing: 0.1,
    lineHeight: 36,
  },
  tabsHeader: {
    backgroundColor: Colors.neutralWhite,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutralGrayLightest,
    // sticky top-[64px] → managed by layout
  },
  countText: {
    fontSize: 14,
    color: Colors.neutralBlack,
    fontWeight: '400',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 8,
  },
  tab: {
    height: 44,                    // h-[56px] on desktop → 44 mobile
    paddingHorizontal: 16,
    borderRadius: 16,              // rounded-[16px]
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  tabActive: {
    backgroundColor: Colors.primaryLight, // bg-[#EAF5FF]
    borderWidth: 2,
    borderColor: Colors.primary,          // border-[#054A86]
  },
  tabInactive: {
    backgroundColor: Colors.neutralWhite,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLight, // border-[#C7C8D2]
  },
  tabText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.neutralBlack,
  },
  tabTextActive: {
    fontWeight: '600',
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 0,
  },
  itemsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  // MenuItemCard
  card: {
    width: (SCREEN_W - 48) / 2,    // ~half screen with gaps
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,              // rounded-[16px]
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest, // border-[#EDEEF2]
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardDimmed: {
    opacity: 0.6,
  },
  cardImageWrap: {
    width: '100%',
    height: 160,                   // h-[180px] → 160 on mobile
    position: 'relative',
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    transform: [{ rotate: '-12deg' }],
  },
  badgeText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 12,
  },
  stockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.orange,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  stockBadgeText: {
    color: Colors.neutralWhite,
    fontSize: 9,
    fontWeight: '700',
  },
  cardContent: {
    padding: 12,
  },
  cardName: {
    fontSize: 18,                  // text-[24px] → 18 for card width
    fontWeight: '700',
    color: Colors.neutralBlack,    // text-[#2B2B43]
    lineHeight: 24,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,                  // text-[14px]
    color: '#83859C',              // text-[#83859C]
    lineHeight: 18,
    marginBottom: 6,
  },
  cardPrice: {
    fontSize: 14,                  // text-[16px]
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  // Shelf layout
  shelvesWrap: {
    gap: 24,
  },
  shelfSection: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  shelfAccent: {
    width: 4,
    height: 32,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  shelfName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
  },
  spotWrap: {
    position: 'relative',
    marginRight: 16,
    marginBottom: 16,
  },
  spotLabel: {
    position: 'absolute',
    top: -6,
    left: -4,
    zIndex: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
  },
  spotLabelText: {
    color: Colors.neutralWhite,
    fontSize: 9,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: Colors.neutralGray,
    fontSize: 16,
  },
});

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  panel: {
    width: Math.min(SCREEN_W, 522), // max-w-[522px]
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
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutralGrayLightest,
  },
  name: {
    fontSize: 24,                  // text-[28px]
    fontWeight: '700',
    color: Colors.neutralBlack,
    flex: 1,
    marginRight: 12,
    lineHeight: 32,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: 240,                   // h-[343px] → 240 mobile
  },
  details: {
    padding: 20,
    gap: 12,
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutralBlack,
  },
  offer: {
    fontSize: 14,
    color: Colors.neutralBlack,
  },
  termsLink: {
    fontSize: 16,
    color: Colors.primaryBlue,     // text-[#056AC1]
    textDecorationLine: 'underline',
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  closeAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeActionText: {
    color: Colors.primary,
    fontWeight: '500',
  },
  orderBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  orderBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
  },
});
