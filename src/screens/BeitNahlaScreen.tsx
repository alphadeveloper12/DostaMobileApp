/**
 * BeitNahlaScreen — faithful translation of web:
 *   - components/home/BeitNahla.tsx      (page wrapper: Header + Footer + nav)
 *   - components/BeitNahla/BeitNahlaMenu.tsx  (all menu logic)
 *
 * Web layout (mobile column form, preserved):
 *   Header (vending variant)
 *   "Beit Nahla" h2 + Open/Closed badge (with working hours)
 *   subtitle
 *   Order Now / Weekly toggle (per-day rate; Weekly = rate × 6 days)
 *   2-col grid of BeitNahlaCard
 *   "Your Selection" summary card (subtotal + per-box breakdown + remove)
 *   Sticky bottom Proceed bar when ≥1 box selected
 *   OptionsDrawer  (per-box option toggles)
 *   AddressMapModal (map pin → distance/charges → cart)
 *   Toast on confirm, then navigate to Cart
 *   MobileFooterNav + Footer
 *
 * All pricing / cart / persistence logic mirrors the web exactly.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { MotiView } from 'moti';
import axios from 'axios';
import { Colors } from '@/utils/colors';
import { BASE_URL } from '@/services/api';
import {
  getAuthToken,
  getSelectedLocation,
  setGuestCart,
  setBeitNahlaCart,
  setBeitNahlaDeliveryInfo,
} from '@/utils/storage';
import { syncLocalCart } from '@/store/slices/cartSlice';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import Shimmer from '@/components/ui/Shimmer';
import BeitNahlaCard, { MealBoxType, SelectedMealBox } from '@/components/BeitNahla/BeitNahlaCard';
import OptionsDrawer, { OptionCategory } from '@/components/BeitNahla/OptionsDrawer';
import AddressMapModal, { AddressData } from '@/components/BeitNahla/AddressMapModal';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - 32 - CARD_GAP) / 2; // 16px padding each side

type Mode = 'ORDER_NOW' | 'WEEKLY';

// "13:00" -> "1:00 PM". Returns "" for blank/invalid input.
const fmt12 = (hhmm?: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${(m || 0).toString().padStart(2, '0')} ${period}`;
};

interface BeitNahlaConfig {
  order_now_price: string;
  weekly_price: string;
  restaurant_name: string;
  restaurant_latitude: string;
  restaurant_longitude: string;
  max_deliverable_km: string;
  opening_time: string; // "HH:MM:SS"
  closing_time: string;
  is_open_now?: boolean;
  current_time?: string;
  tiers: Array<{
    id: number;
    label: string;
    min_km: string;
    max_km: string;
    service_charge: string;
    delivery_charge: string;
  }>;
}

const WEEKLY_DAYS = 6;

export default function BeitNahlaScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();

  const [config, setConfig] = useState<BeitNahlaConfig | null>(null);
  const [boxes, setBoxes] = useState<MealBoxType[]>([]);
  const [categories, setCategories] = useState<OptionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>('ORDER_NOW');
  const [selections, setSelections] = useState<SelectedMealBox[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeBox, setActiveBox] = useState<MealBoxType | null>(null);

  const [addressOpen, setAddressOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Weekly = 6 days × per-day price. Order Now = single-day price.
  const perDayPrice = useMemo(() => {
    if (!config) return mode === 'ORDER_NOW' ? 40 : 35;
    return parseFloat(mode === 'ORDER_NOW' ? config.order_now_price : config.weekly_price);
  }, [config, mode]);
  const unitPrice = useMemo(
    () => (mode === 'WEEKLY' ? perDayPrice * WEEKLY_DAYS : perDayPrice),
    [perDayPrice, mode],
  );

  // Fetch config + boxes + options. Extracted so the error-state "Try again"
  // button can re-invoke it. A 15s timeout means an unreachable backend fails
  // fast with a clear message instead of hanging on the TCP connect.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const headers: any = token ? { Authorization: `Token ${token}` } : {};
      const opts = { headers, timeout: 15000 };
      const [cfgRes, boxRes, optRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/catering/beit-nahla/config/`, opts),
        axios.get(`${BASE_URL}/api/catering/beit-nahla/meal-boxes/`, opts),
        axios.get(`${BASE_URL}/api/catering/beit-nahla/options/`, opts),
      ]);
      setConfig(cfgRes.data);
      setBoxes(boxRes.data);
      setCategories(optRes.data);
    } catch (e: any) {
      // Surface the real reason — a swallowed catch is why nothing showed in
      // the debugger before. Network/timeout vs. HTTP status are different fixes.
      const status = e?.response?.status;
      console.error('Beit Nahla load failed:', status || e?.code || e?.message, e?.config?.url);
      setError(
        status
          ? `Server error (${status}) loading the Beit Nahla menu.`
          : `Couldn't reach the server (${BASE_URL}). Check your connection and that the backend is online.`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When mode changes, refresh unitPrice on existing selections
  useEffect(() => {
    setSelections((prev) => prev.map((s) => ({ ...s, unitPrice })));
  }, [unitPrice]);

  const totalQuantity = selections.length;
  const subtotal = selections.reduce((s, sel) => s + sel.unitPrice, 0);

  const isBoxSelected = (boxId: number) => selections.some((s) => s.box.id === boxId);

  const handleSeeOptions = (box: MealBoxType) => {
    setActiveBox(box);
    setDrawerOpen(true);
  };

  const handleDrawerConfirm = (sel: Record<number, number[]>) => {
    if (!activeBox) return;
    setSelections((prev) => {
      const others = prev.filter((s) => s.box.id !== activeBox.id);
      return [...others, { box: activeBox, selections: sel, unitPrice }];
    });
    setDrawerOpen(false);
    setActiveBox(null);
  };

  const removeSelection = (boxId: number) => {
    setSelections((prev) => prev.filter((s) => s.box.id !== boxId));
  };

  const handleProceed = () => {
    if (selections.length === 0) return;
    setAddressOpen(true);
  };

  // Build the human-readable "Category: a, b | Category: c" label for a box.
  const optionNamesByCategoryId = useCallback(
    (catId: number, ids: number[]) => {
      const cat = categories.find((c) => c.id === catId);
      if (!cat) return [];
      return ids
        .map((id) => cat.items.find((i) => i.id === id)?.name)
        .filter(Boolean) as string[];
    },
    [categories],
  );

  const buildSelectionLabel = useCallback(
    (sel: SelectedMealBox) => {
      const parts: string[] = [];
      for (const cat of categories) {
        const ids = sel.selections[cat.id] || [];
        if (ids.length === 0) continue;
        parts.push(`${cat.name}: ${optionNamesByCategoryId(cat.id, ids).join(', ')}`);
      }
      return parts.join(' | ');
    },
    [categories, optionNamesByCategoryId],
  );

  const handleAddressSubmit = async (data: AddressData) => {
    setAddressOpen(false);
    const planType = 'BEIT_NAHLA';
    const planSubtype = mode === 'WEEKLY' ? 'WEEKLY' : 'NONE';

    const reduxCartItems = selections.map((sel, idx) => {
      const description = buildSelectionLabel(sel);
      return {
        id: Math.floor(Math.random() * 1000000) + idx,
        menu_item_id: sel.box.id,
        menu_item: {
          id: sel.box.id,
          name: `${sel.box.name} (${mode === 'WEEKLY' ? 'Weekly' : 'Order Now'})`,
          price: sel.unitPrice.toFixed(2),
          image_url: sel.box.image_url,
          heating: 'no',
          description,
        },
        heading: sel.box.name,
        imgSrc: sel.box.image_url,
        price: sel.unitPrice,
        quantity: 1,
        day_of_week: null,
        week_number: null,
        vending_good_uuid: null,
        plan_type: planType,
        plan_subtype: planSubtype,
      };
    });

    dispatch(syncLocalCart(reduxCartItems));

    // Persist Beit Nahla items in a dedicated key — the vending backend has no
    // FK for BEIT_NAHLA boxes, so we keep them client-side (cart merges them).
    try {
      await setBeitNahlaCart({ items: reduxCartItems });
    } catch (e) {
      console.error('Failed to persist beitNahlaCart:', e);
    }

    let locId = 1;
    try {
      const selectedLocation = await getSelectedLocation();
      locId = Number(selectedLocation?.location?.id) || 1;
    } catch {
      locId = 1;
    }

    const deliveryTotal = data.delivery.total_extra;

    // Persist address + delivery info for Cart/checkout
    await setBeitNahlaDeliveryInfo({
      address: data.address,
      phone: data.phone,
      name: data.name,
      building: data.building,
      street: data.street,
      appt: data.appt,
      latitude: data.latitude,
      longitude: data.longitude,
      distance_km: data.delivery.distance_km,
      service_charge: data.delivery.service_charge,
      delivery_charge: data.delivery.delivery_charge,
      total_extra: deliveryTotal,
      tier_label: data.delivery.tier_label,
      mode,
    });

    const payload = {
      location_id: locId,
      plan_type: planType,
      plan_subtype: planSubtype,
      pickup_type: 'TODAY',
      pickup_date: new Date().toISOString().split('T')[0],
      pickup_slot_id: null,
      city: 'Dubai',
      delivery_charge: deliveryTotal,
      items: selections.map((sel) => ({
        id: sel.box.id,
        menu_item_id: sel.box.id,
        variation_id: null,
        quantity: 1,
        day_of_week: null,
        week_number: null,
        vending_good_uuid: null,
        plan_type: planType,
        plan_subtype: planSubtype,
        menu_item: {
          id: sel.box.id,
          name: `${sel.box.name} (${mode === 'WEEKLY' ? 'Weekly' : 'Order Now'})`,
          price: sel.unitPrice.toFixed(2),
          image_url: sel.box.image_url,
          description: buildSelectionLabel(sel),
        },
      })),
      current_step: 4,
    };

    try {
      const token = await getAuthToken();
      if (token) {
        await axios.post(`${BASE_URL}/api/vending/cart/`, payload, {
          headers: { Authorization: `Token ${token}` },
        });
      } else {
        await setGuestCart(payload);
      }
    } catch (e) {
      console.error('Beit Nahla cart sync error:', e);
    }

    setToast('Beit Nahla order confirmed!');
    setTimeout(() => {
      setToast(null);
      navigation.navigate('Cart');
    }, 1200);
  };

  // Per-day rates shown on the toggle.
  const orderNowDayPrice = config ? parseFloat(config.order_now_price) : 40;
  const weeklyDayPrice = config ? parseFloat(config.weekly_price) : 35;
  const orderNowPriceLabel = `AED ${orderNowDayPrice.toFixed(2)}`;
  const weeklyPriceLabel = `AED ${weeklyDayPrice.toFixed(2)}/day × ${WEEKLY_DAYS}`;
  const currentPriceLabel = `AED ${unitPrice.toFixed(2)}`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header variant="beitnahla" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Title + open/closed badge */}
        <View style={styles.titleArea}>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Beit Nahla</Text>
            {config && (
              <View style={[styles.statusBadge, config.is_open_now ? styles.statusOpen : styles.statusClosed]}>
                <Text style={[styles.statusText, { color: config.is_open_now ? '#047857' : '#B91C1C' }]}>
                  {config.is_open_now ? 'Open now' : 'Closed'}
                </Text>
                <Text style={styles.statusHours}>
                  {' · '}
                  {fmt12(config.opening_time?.slice(0, 5))} – {fmt12(config.closing_time?.slice(0, 5))}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>
            Pick your meal boxes, choose what's inside, and we'll deliver. Switch between
            Order Now and Weekly pricing.
          </Text>

          {/* Order Now / Weekly toggle */}
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'ORDER_NOW' && styles.toggleBtnActive]}
              onPress={() => setMode('ORDER_NOW')}
              activeOpacity={0.85}>
              <Text style={[styles.toggleTitle, mode === 'ORDER_NOW' && styles.toggleTitleActive]}>
                Order Now
              </Text>
              <Text style={[styles.togglePrice, mode === 'ORDER_NOW' && styles.toggleTitleActive]}>
                {orderNowPriceLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'WEEKLY' && styles.toggleBtnActive]}
              onPress={() => setMode('WEEKLY')}
              activeOpacity={0.85}>
              <Text style={[styles.toggleTitle, mode === 'WEEKLY' && styles.toggleTitleActive]}>
                Weekly
              </Text>
              <Text style={[styles.togglePrice, mode === 'WEEKLY' && styles.toggleTitleActive]}>
                {weeklyPriceLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Boxes / loading / error / empty */}
        <View style={styles.gridArea}>
          {loading ? (
            <Shimmer />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : boxes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyBoxText}>
                No meal boxes available yet. Check back soon.
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {boxes.map((box) => (
                <View key={box.id} style={{ width: CARD_W }}>
                  <BeitNahlaCard
                    data={box}
                    priceLabel={currentPriceLabel}
                    priceSuffix={mode === 'WEEKLY' ? `per box · ${WEEKLY_DAYS} days` : 'per box'}
                    isSelected={isBoxSelected(box.id)}
                    onSeeOptions={handleSeeOptions}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Your Selection summary */}
        <View style={styles.selectionCard}>
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionTitle}>Your Selection</Text>
            <View style={styles.selectionCountPill}>
              <Text style={styles.selectionCountText}>
                {totalQuantity} box{totalQuantity === 1 ? '' : 'es'}
              </Text>
            </View>
          </View>
          <Text style={styles.selectionMode}>
            {mode === 'WEEKLY'
              ? 'Weekly pricing applied to all boxes.'
              : 'Order Now pricing applied to all boxes.'}
          </Text>

          {selections.length > 0 ? (
            selections.map((sel) => {
              const desc = Object.entries(sel.selections)
                .map(([catId, ids]) => {
                  const cat = categories.find((c) => c.id === Number(catId));
                  if (!cat) return '';
                  const names = ids
                    .map((id) => cat.items.find((it) => it.id === id)?.name)
                    .filter(Boolean);
                  return names.length > 0 ? `${cat.name}: ${names.join(', ')}` : '';
                })
                .filter(Boolean)
                .join(' · ');
              return (
                <View key={sel.box.id} style={styles.selRow}>
                  <View style={styles.selRowText}>
                    <Text style={styles.selBoxName} numberOfLines={1}>
                      {sel.box.name}
                    </Text>
                    {!!desc && (
                      <Text style={styles.selBoxDesc} numberOfLines={2}>
                        {desc}
                      </Text>
                    )}
                    <Text style={styles.selBoxPrice}>AED {sel.unitPrice.toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeSelection(sel.box.id)}>
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <View style={styles.selEmpty}>
              <Text style={styles.selEmptyTitle}>No boxes selected.</Text>
              <Text style={styles.selEmptySub}>Tap "See options" on a box to begin.</Text>
            </View>
          )}

          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalKey}>Subtotal</Text>
            <Text style={styles.subtotalVal}>AED {subtotal.toFixed(2)}</Text>
          </View>
          <Text style={styles.subtotalNote}>
            Service + delivery charges are calculated from your map pin in the next step.
          </Text>

          <TouchableOpacity
            style={[styles.continueBtn, selections.length === 0 && styles.continueBtnDisabled]}
            disabled={selections.length === 0}
            onPress={handleProceed}>
            <Text
              style={[
                styles.continueBtnText,
                selections.length === 0 && styles.continueBtnTextDisabled,
              ]}>
              Set Address & Continue
            </Text>
          </TouchableOpacity>
        </View>

        <Footer />
        <View style={{ height: selections.length > 0 ? 96 : 16 }} />
      </ScrollView>

      {/* Sticky bottom bar — appears when ≥1 box selected (web md:hidden bar) */}
      {selections.length > 0 && (
        <View style={[styles.stickyBar, { bottom: 70 + Math.max(insets.bottom, 12) }]}>
          <View>
            <Text style={styles.stickyCount}>
              {totalQuantity} box{totalQuantity === 1 ? '' : 'es'}
            </Text>
            <Text style={styles.stickyTotal}>AED {subtotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.stickyBtn} onPress={handleProceed}>
            <Text style={styles.stickyBtnText}>Proceed</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Options drawer */}
      <OptionsDrawer
        open={drawerOpen}
        mealBox={activeBox}
        categories={categories}
        initialSelections={
          activeBox ? selections.find((s) => s.box.id === activeBox.id)?.selections : undefined
        }
        onClose={() => {
          setDrawerOpen(false);
          setActiveBox(null);
        }}
        onConfirm={handleDrawerConfirm}
      />

      {/* Address + map */}
      <AddressMapModal
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        onSubmit={handleAddressSubmit}
        defaultLat={config ? parseFloat(config.restaurant_latitude) : 25.2048}
        defaultLng={config ? parseFloat(config.restaurant_longitude) : 55.2708}
        openingTime={config?.opening_time?.slice(0, 5)}
        closingTime={config?.closing_time?.slice(0, 5)}
      />

      {/* Toast */}
      {!!toast && (
        <MotiView
          from={{ opacity: 0, translateY: -16 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={[styles.toast, { top: insets.top + 16 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </MotiView>
      )}

      <MobileFooterNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFD',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  // Title
  titleArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusOpen: {
    backgroundColor: '#D1FAE5',
  },
  statusClosed: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusHours: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.neutralGrayDark,
    opacity: 0.8,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.neutralGrayDark,
    lineHeight: 20,
    marginTop: 8,
  },
  // Toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 12,
    padding: 4,
    marginTop: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.neutralWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.neutralGrayDark,
  },
  toggleTitleActive: {
    color: Colors.primary,
  },
  togglePrice: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.neutralGrayDark,
    marginTop: 2,
  },
  // Grid
  gridArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  errorBox: {
    paddingVertical: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
  },
  errorBoxText: {
    color: Colors.secondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyBox: {
    paddingVertical: 40,
    borderRadius: 12,
    backgroundColor: '#FAFAFD',
    alignItems: 'center',
  },
  emptyBoxText: {
    color: '#83859C',
    fontSize: 14,
  },
  // Selection card
  selectionCard: {
    margin: 16,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  selectionCountPill: {
    backgroundColor: 'rgba(5,74,134,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  selectionCountText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  selectionMode: {
    fontSize: 12,
    color: '#83859C',
    marginBottom: 16,
  },
  selRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selRowText: {
    flex: 1,
    gap: 4,
  },
  selBoxName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutralBlack,
  },
  selBoxDesc: {
    fontSize: 12,
    color: '#83859C',
  },
  selBoxPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 2,
  },
  removeBtn: {
    backgroundColor: Colors.neutralGrayLightest,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  removeBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  selEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  selEmptyTitle: {
    color: '#83859C',
    fontSize: 14,
  },
  selEmptySub: {
    color: '#83859C',
    fontSize: 12,
    marginTop: 4,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
  },
  subtotalKey: {
    fontSize: 14,
    color: Colors.neutralGrayDark,
  },
  subtotalVal: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutralBlack,
  },
  subtotalNote: {
    fontSize: 11,
    color: '#83859C',
    marginTop: 8,
    marginBottom: 16,
  },
  continueBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: '#F7F7F9',
  },
  continueBtnText: {
    color: Colors.neutralWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  continueBtnTextDisabled: {
    color: '#C7C8D2',
  },
  // Sticky bottom bar
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Colors.neutralWhite,
    borderTopWidth: 1,
    borderTopColor: Colors.neutralGrayLightest,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 40,
  },
  stickyCount: {
    fontSize: 12,
    color: '#83859C',
  },
  stickyTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  stickyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyBtnText: {
    color: Colors.neutralWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  // Toast
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    minWidth: 280,
    backgroundColor: '#E8F9F1',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 120,
  },
  toastText: {
    color: Colors.neutralBlack,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
});
