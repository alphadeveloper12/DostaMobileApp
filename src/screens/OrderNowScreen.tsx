/**
 * OrderNowScreen — faithful 1:1 translation of web components/vending_home/OrderNow.tsx
 *
 * Multi-step wizard:
 *   Step 1: Select Pickup Location (from selectedLocation storage)
 *   Step 2: Choose order type (Order Now / Smart Grab / Start a Plan + subtype)
 *           API: GET /api/vending/plan-types/ → planTypeOptions
 *                GET /api/vending/plan-options/ → planSubTypes
 *   Step 3: Set Pickup Time
 *           API: GET /api/vending/pickup-options/?location_id=X → pickup types + time slots
 *   Step 4: Choose Your Meal (varies by order type):
 *     Order Now   → GET /api/vending/menu/ORDER_NOW/ + machine goods filter
 *     Smart Grab  → machine goods from /api/vending/external/machine-goods/
 *     Weekly Plan → GET /api/vending/menu/plan/WEEKLY/
 *     Monthly     → GET /api/vending/menu/plan/MONTHLY/ (4 weeks = steps 4-7)
 *
 * Each step confirm → POST /api/vending/cart/ with {
 *   location_id, plan_type, plan_subtype, pickup_type, pickup_date,
 *   pickup_slot_id, items, current_step
 * }
 *
 * On mount: restore state from GET /api/vending/cart/
 * Machine goods: cached 5 min in AsyncStorage
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, FlatList, Modal,
  TouchableWithoutFeedback, Alert, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check, Minus, Plus, X, ChevronDown } from 'lucide-react-native';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { MotiView } from 'moti';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import BreadCrumb from '@/components/ui/BreadCrumb';
import Shimmer from '@/components/ui/Shimmer';
import AuthPromptModal from '@/components/common/AuthPromptModal';
import ImageLightbox from '@/components/common/ImageLightbox';
import { syncLocalCart } from '@/store/slices/cartSlice';
import {
  getAuthToken, getSelectedLocation,
  getMachineGoodsCache, setMachineGoodsCache,
  getGuestCart, setGuestCart,
} from '@/utils/storage';
import { BASE_URL } from '@/services/api';

const { width: W } = Dimensions.get('window');

// ── Step status ────────────────────────────────────────────────────────────────
type StepStatus = 'active' | 'completed' | 'pending';

// ── Helpers identical to web ──────────────────────────────────────────────────
const normalizeName = (n: string) =>
  (n || '').replace(/&/g, 'and').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const generateCartSummary = (cart: any[]) => {
  const totalMeals = (cart || []).reduce((a, i) => a + (i.quantity || 1), 0);
  const line = (cart || []).map(i => `${i.heading}${i.quantity > 1 ? ` (x${i.quantity})` : ''}`).join(', ');
  return { totalMeals, line };
};

const generatePlanSummary = (plan: any) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  let totalMeals = 0; const lines: string[] = [];
  for (const day of days) {
    const items = plan?.[day] || [];
    if (items.length > 0) {
      let dt = 0; const titles: string[] = [];
      for (const i of items) { const q = i.quantity || 1; dt += q; titles.push(`${i.heading}${q > 1 ? ` (x${q})` : ''}`); }
      totalMeals += dt;
      lines.push(`${day}: ${titles.join(', ')}`);
    }
  }
  return { totalMeals, lines };
};

// ── Step circle component ─────────────────────────────────────────────────────
const StepCircle = ({ n, status }: { n: number; status: StepStatus }) => (
  <View style={[s.circle, status === 'completed' ? s.circleGreen : s.circleBlue]}>
    {status === 'completed'
      ? <Check size={14} color="#fff" />
      : <Text style={s.circleText}>{n}</Text>}
  </View>
);

// ── Step card wrapper ─────────────────────────────────────────────────────────
const StepCard = ({ status, children }: { status: StepStatus; children: React.ReactNode }) =>
  status === 'pending' ? null : (
    <View style={[s.card, status === 'active' && s.cardActive]}>{children}</View>
  );

// ── Menu item card — faithful port of web MenuCard.tsx (mobile sizing) ───────
//   - Single-line heading (text-[14px] line-clamp-1)
//   - 2-line description (text-[11px] line-clamp-2)
//   - Inline quantity stepper next to price (no separate "Add" row)
//   - Card border becomes blue (#054A86) when item is in cart
//   - Tap card → opens detail sidebar; +/- buttons stop propagation
const FoodCard = ({ item, qty, onAdd, onRemove, onPress, isSoldOut, isLocked }: any) => {
  const inCart = qty > 0;
  return (
    <TouchableOpacity
      style={[
        s.foodCard,
        inCart && s.foodCardSelected,
        (isSoldOut || isLocked) && { opacity: 0.6 },
      ]}
      onPress={onPress}
      // Sold-out (and locked) cards are fully disabled: tapping does nothing —
      // no detail sidebar opens, so the item can't be added.
      disabled={isSoldOut || isLocked}
      activeOpacity={0.85}>

      {/* Image — web mobile h-[120px] rounded-[12px] */}
      <View style={s.foodImgWrap}>
        <Image
          source={{ uri: item.imgSrc || item.image_url }}
          style={s.foodImg}
          contentFit="cover"
          placeholder={{ color: Colors.neutralGrayLightest }}
        />
        {isLocked && (
          <View style={s.foodOverlay}>
            <View style={[s.foodBadge, { backgroundColor: Colors.orange }]}>
              <Text style={s.foodBadgeText}>LOCKED</Text>
            </View>
          </View>
        )}
        {!isLocked && isSoldOut && (
          <View style={s.foodOverlay}>
            <View style={[s.foodBadge, { backgroundColor: '#EF4444' }]}>
              <Text style={s.foodBadgeText}>SOLD OUT</Text>
            </View>
          </View>
        )}
      </View>

      {/* Heading — text-[14px] leading-[20px] font-[700] line-clamp-1 */}
      <Text style={s.foodName} numberOfLines={1}>
        {item.heading || item.name}
      </Text>
      {/* Description — text-[11px] leading-[16px] line-clamp-2 #83859C */}
      <Text style={s.foodDesc} numberOfLines={2}>
        {item.description}
      </Text>

      {/* Bottom row — price | inline qty stepper or + button (web pattern) */}
      <View style={s.foodFooter}>
        <Text style={s.foodPrice}>{item.price}</Text>

        {inCart ? (
          <View style={s.qtyStepper}>
            <TouchableOpacity
              onPress={(e: any) => { e?.stopPropagation?.(); onRemove(); }}
              style={s.qtyStepBtn}
              hitSlop={6}>
              <Minus size={14} color={Colors.neutralBlack} />
            </TouchableOpacity>
            <Text style={s.qtyStepText}>{qty}</Text>
            <TouchableOpacity
              onPress={(e: any) => { e?.stopPropagation?.(); onAdd(); }}
              style={s.qtyStepBtn}
              hitSlop={6}>
              <Plus size={14} color={Colors.neutralBlack} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={(e: any) => { e?.stopPropagation?.(); onAdd(); }}
            disabled={isSoldOut || isLocked}
            style={s.foodPlusBtn}
            hitSlop={6}>
            <Plus size={22} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ── Weekly plan day grid ───────────────────────────────────────────────────────
// Faithful port of web Dosta/src/components/vending_home/PlanWeekly.tsx (mobile):
//   - Title "Choose meals for each weekday :"
//   - Day dropdown (web mobile uses <select>)  + Saved Plans button
//   - Status row "Selected for {day}: ..." / "Total: N Meals"
//   - Pickup Time per day dropdown (when timeSlots provided)
//   - 2-col FoodCard grid (web `grid-cols-2 gap-[12px]`)
//   - Tap card → opens detail sidebar; +/- inline stepper limited to 3
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const FEATURES = ['Select your favorite', 'Preselected For You'];

const formatItem = (raw: any) => ({
  ...raw,
  id:       raw.id,
  imgSrc:   raw.image_url || raw.imgSrc,
  // Mirrors web `imgSrc2: it.image2_url || it.image_url` — the second image
  // is the one rendered inside the detail panel and full-screen preview.
  imgSrc2:  raw.image2_url || raw.imgSrc2 || raw.image_url || raw.imgSrc,
  imgAlt:   `food-${raw.id}`,
  heading:  raw.name || raw.heading,
  description: raw.description,
  price:    typeof raw.price === 'string' && raw.price.startsWith('AED')
    ? raw.price
    : `AED ${parseFloat(raw.price || 0).toFixed(2)}`,
});

const WeeklyPlanPicker = ({
  apiMenuData,
  weekPlan,
  setWeekPlan,
  weekNumber = 1,
  timeSlots = [],
  dayPickupSlots = {},
  setDayPickupSlots,
  defaultSlotId,
  onItemPress,
  onConfirm,
  onReset,
  loading,
}: {
  apiMenuData: any;
  weekPlan: any;
  setWeekPlan: (p: any) => void;
  weekNumber?: number;
  timeSlots?: any[];
  dayPickupSlots?: Record<string, number>;
  setDayPickupSlots?: (cb: any) => void;
  defaultSlotId?: number | null;
  onItemPress?: (item: any) => void;
  onConfirm?: () => void;
  onReset?: () => void;
  loading?: boolean;
}) => {
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [feature, setFeature]         = useState<number | null>(null);
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const dayItems = useMemo(() => {
    // Tolerate every shape the API or the parent might hand us:
    //   weekly flat:        { Monday: { items: [...] }, ... }
    //   weekly wrapped:     { week_menu: { Monday: {...} } }
    //   monthly per-week:   { menu: { Monday: { items: [...] } } }
    //   monthly already unwrapped (web pattern): { Monday: { items: [...] } }
    const root =
      apiMenuData?.week_menu ||
      apiMenuData?.menu      ||
      apiMenuData             ||
      null;
    const raw = root?.[selectedDay]?.items
             || (Array.isArray(root?.[selectedDay]) ? root[selectedDay] : null)
             || [];
    return raw.map(formatItem);
  }, [apiMenuData, selectedDay]);

  const selectedDayItems: any[] = Array.isArray(weekPlan[selectedDay]) ? weekPlan[selectedDay] : [];
  const totalMealsForDay = selectedDayItems.reduce((a, i) => a + (i.quantity || 1), 0);

  // Mirror of web handleQuantityChange — caps quantity at 3
  const changeQty = (item: any, delta: number) => {
    const curr = Array.isArray(weekPlan[selectedDay]) ? weekPlan[selectedDay] : [];
    const idx  = curr.findIndex((i: any) => i.id === item.id);
    let next   = [...curr];
    if (idx >= 0) {
      const newQ = next[idx].quantity + delta;
      if (newQ <= 0) next.splice(idx, 1);
      else if (newQ > 3) return;
      else next[idx] = { ...next[idx], quantity: newQ };
    } else if (delta > 0) {
      next.push({ ...item, day_of_week: selectedDay, week_number: weekNumber, quantity: 1 });
    }
    setWeekPlan({ ...weekPlan, [selectedDay]: next });
  };

  const slotKey   = `${weekNumber}-${selectedDay}`;
  const activeSlotId = dayPickupSlots[slotKey] || defaultSlotId || null;
  const activeSlotLabel = timeSlots.find((s: any) => s.id === activeSlotId)?.label || 'Select time';

  return (
    <View>
      {/* Title */}
      <Text style={wp.title}>Choose meals for each weekday :</Text>

      {/* Two preset toggle buttons (matches web FEATURES row) */}
      <View style={wp.featureRow}>
        {FEATURES.map((label, idx) => (
          <TouchableOpacity
            key={label}
            style={[wp.featureBtn, feature === idx && wp.featureBtnActive]}
            onPress={() => setFeature(idx)}
            activeOpacity={0.85}>
            <Text
              style={[wp.featureBtnText, feature === idx && wp.featureBtnTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day dropdown + Saved Plans (web mobile layout) */}
      <View style={wp.dayRow}>
        <TouchableOpacity
          style={wp.dayDropdown}
          onPress={() => setDayPickerOpen(true)}
          activeOpacity={0.85}>
          <Text style={wp.dayDropdownText}>{selectedDay}</Text>
          <ChevronDown size={14} color={Colors.primary} />
        </TouchableOpacity>
        <View style={wp.savedBtn}>
          <Text style={wp.savedBtnText}>Saved Plans</Text>
        </View>
      </View>

      {/* Status row — Selected for X: ... + Total: N Meals */}
      <View style={wp.statusBlock}>
        <Text style={wp.statusText} numberOfLines={2}>
          {selectedDayItems.length === 0
            ? 'No selected meals'
            : `Selected for ${selectedDay}: ${selectedDayItems.map((i: any) => `${i.heading}${i.quantity > 1 ? ` (x${i.quantity})` : ''}`).join(', ')}`}
        </Text>
        <Text style={wp.statusTotalText}>
          Total: <Text style={wp.statusTotalBold}>{totalMealsForDay} {totalMealsForDay === 1 ? 'Meal' : 'Meals'}</Text>
        </Text>
      </View>

      {/* Pickup Time per day */}
      {timeSlots.length > 0 && (
        <View style={wp.pickupRow}>
          <Text style={wp.pickupLabel}>Pickup Time:</Text>
          <TouchableOpacity
            style={wp.pickupDropdown}
            onPress={() => setTimePickerOpen(true)}
            activeOpacity={0.85}>
            <Text style={wp.pickupDropdownText} numberOfLines={1}>
              {activeSlotLabel}
            </Text>
            <ChevronDown size={14} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* 2-col food card grid */}
      {dayItems.length === 0 ? (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text style={{ color: Colors.neutralGray }}>No menu items for {selectedDay}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {dayItems.map((item: any) => {
            const sel = selectedDayItems.find((i: any) => i.id === item.id);
            const qty = sel?.quantity || 0;
            return (
              <View key={item.id} style={{ width: '47%' }}>
                <FoodCard
                  item={item}
                  qty={qty}
                  onAdd={() => changeQty(item, +1)}
                  onRemove={() => changeQty(item, -1)}
                  onPress={() => onItemPress?.({
                    ...item,
                    _ctx: 'weekly',
                    _day: selectedDay,
                    _week: weekNumber,
                    // Pass the setter directly. The parent's Add handler will
                    // use a functional setState against this — that way no
                    // closure staleness, no routing mistakes.
                    _setter: setWeekPlan,
                  })}
                />
              </View>
            );
          })}
        </View>
      )}

      {/* Inline action buttons (web mobile: Reset + Confirm and review).
          Sits at the bottom of the picker — no floating bar on weekly. */}
      {(() => {
        const totalMealsInPlan = Object.values(weekPlan).reduce(
          (planTotal: number, day: any) =>
            Array.isArray(day)
              ? planTotal + day.reduce((dt: number, i: any) => dt + (i?.quantity || 0), 0)
              : planTotal,
          0,
        );
        const canReset   = selectedDayItems.length > 0;
        const canConfirm = totalMealsInPlan > 0;
        return (
          <View style={wp.actionsCol}>
            {canReset && (
              <TouchableOpacity
                style={wp.resetBtn}
                onPress={onReset}
                activeOpacity={0.85}>
                <Text style={wp.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[wp.confirmBtn, !canConfirm && wp.confirmBtnDisabled]}
              disabled={!canConfirm || loading}
              onPress={onConfirm}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color={Colors.neutralWhite} />
              ) : (
                <Text style={[wp.confirmBtnText, !canConfirm && wp.confirmBtnTextDisabled]}>
                  Confirm and review
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Day picker modal */}
      <Modal
        visible={dayPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDayPickerOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setDayPickerOpen(false)}>
          <View style={wp.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={wp.modalSheet}>
                <Text style={wp.modalTitle}>Choose a day</Text>
                {DAYS.map((d, idx) => {
                  const isActive = selectedDay === d;
                  const count    = (weekPlan[d]?.length || 0);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[wp.modalItem, isActive && wp.modalItemActive]}
                      onPress={() => { setSelectedDay(d); setDayPickerOpen(false); }}>
                      <Text style={[wp.modalItemText, isActive && wp.modalItemTextActive]}>
                        {d}{count > 0 ? ` (${count})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Pickup time picker modal */}
      <Modal
        visible={timePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setTimePickerOpen(false)}>
          <View style={wp.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={wp.modalSheet}>
                <Text style={wp.modalTitle}>Pickup time for {selectedDay}</Text>
                {timeSlots.map((slot: any) => {
                  const isActive = slot.id === activeSlotId;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[wp.modalItem, isActive && wp.modalItemActive]}
                      onPress={() => {
                        if (setDayPickupSlots) {
                          setDayPickupSlots((prev: Record<string, number>) => ({
                            ...prev,
                            [slotKey]: slot.id,
                          }));
                        }
                        setTimePickerOpen(false);
                      }}>
                      <Text style={[wp.modalItemText, isActive && wp.modalItemTextActive]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function OrderNowScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const dispatch   = useDispatch();

  // Step tracking
  const [activeStep,    setActiveStep]    = useState(1);
  const [maxCompleted,  setMaxCompleted]  = useState(0);

  // Step 1 — Location
  const [pickupLocation, setPickupLocation] = useState('no location selected');
  const [locationId,     setLocationId]     = useState<number>(1);

  // Step 2 — Order type
  const [orderType,    setOrderType]    = useState('');
  const [planType,     setPlanType]     = useState('');  // 'weekly' | 'monthly'
  const [planTypeOptions, setPlanTypeOptions] = useState<any[]>([]);
  const [planSubTypes,    setPlanSubTypes]    = useState<any[]>([]);

  // Step 3 — Pickup time
  const [pickOrder,     setPickOrder]    = useState('');
  const [time,          setTime]         = useState('');
  const [pickupOptions, setPickupOptions]= useState<any[]>([]);
  const [timeSlots,     setTimeSlots]    = useState<any[]>([]);
  const [showTimeModal, setShowTimeModal]= useState(false);

  // Step 4 — Menu
  const [orderNowMenu,  setOrderNowMenu]  = useState<any[]>([]);
  const [smartGrabMenu, setSmartGrabMenu] = useState<any[]>([]);
  const [weekMenu,      setWeekMenu]      = useState<any>({});
  const [weekMenu1, setWeekMenu1]         = useState<any>({});
  const [weekMenu2, setWeekMenu2]         = useState<any>({});
  const [weekMenu3, setWeekMenu3]         = useState<any>({});
  const [weekMenu4, setWeekMenu4]         = useState<any>({});

  // API data
  const [apiOrderNowMenu,  setApiOrderNowMenu]  = useState<any[]>([]);
  const [apiWeeklyMenu,    setApiWeeklyMenu]     = useState<any>(null);
  const [apiMonthlyMenu,   setApiMonthlyMenu]    = useState<any>(null);
  const [machineGoods,     setMachineGoods]      = useState<any[] | null>(null);
  const [machineShelves,   setMachineShelves]    = useState<any[] | null>(null);
  const [dayPickupSlots,   setDayPickupSlots]    = useState<Record<string, number>>({});

  // UI
  const [selectedItem,  setSelectedItem]  = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // URI of the image being shown full-screen inside <ImageLightbox>, or null
  // when closed. Mirrors web `lightboxOpen` + `selectedItem.imgSrc2`.
  const [lightboxUri,   setLightboxUri]   = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [menuLoading,   setMenuLoading]   = useState(false);

  const getStepStatus = (stepId: number): StepStatus => {
    if (stepId === activeStep)    return 'active';
    if (stepId <= maxCompleted)   return 'completed';
    return 'pending';
  };

  const handleEditStep = (stepId: number) => {
    setActiveStep(stepId);
    setMaxCompleted(stepId - 1);
  };

  // ── On mount: restore from cart API ──────────────────────────────────────────
  useEffect(() => {
    const restore = async () => {
      try {
        const token = await getAuthToken();
        let cart: any = null;

        if (token) {
          const res = await axios.get(`${BASE_URL}/api/vending/cart/`, { headers: { Authorization: `Token ${token}` } });
          cart = res.data;
        } else {
          cart = await getGuestCart();
        }

        if (cart && (cart.items?.length > 0 || (cart.current_step && cart.current_step > 1))) {
          if (cart.location) setPickupLocation(`${cart.location.name}, ${cart.location.info}`);

          let step = cart.current_step || 1;
          if (step === 1 && (cart.plan_type !== 'NONE' || cart.items?.length > 0)) step = 2;
          setActiveStep(step);
          setMaxCompleted(Math.max(0, step - 1));

          const typeMap: any = { ORDER_NOW: 'Order Now', SMART_GRAB: 'Smart Grab', START_PLAN: 'Start a Plan' };
          if (cart.plan_type) setOrderType(typeMap[cart.plan_type] || '');

          const rawSubtype = cart.plan_subtype || cart.plan_sub_type;
          if (rawSubtype && rawSubtype !== 'NONE') setPlanType(String(rawSubtype).toLowerCase());

          const pMap: any = { TODAY: 'Pickup Today', IN_24_HOURS: 'Pickup in 24 hours' };
          if (cart.pickup_type) setPickOrder(pMap[cart.pickup_type] || '');
          if (cart.pickup_slot) setTime(cart.pickup_slot.label);

          const restoredItems = (cart.items || []).map((i: any) => ({
            ...i.menu_item, heading: i.menu_item.name,
            imgSrc: i.menu_item.image_url, quantity: i.quantity, id: i.menu_item.id,
            price: `AED ${parseFloat(i.menu_item.price).toFixed(2)}`,
          }));

          if (cart.plan_type === 'ORDER_NOW') setOrderNowMenu(restoredItems);
          else if (cart.plan_type === 'SMART_GRAB') setSmartGrabMenu(restoredItems);
          else if (cart.plan_type === 'START_PLAN' && cart.plan_subtype === 'WEEKLY') {
            const wk: any = {};
            (cart.items || []).forEach((i: any) => {
              const d = i.day_of_week;
              if (!wk[d]) wk[d] = [];
              wk[d].push({ ...i.menu_item, heading: i.menu_item.name, imgSrc: i.menu_item.image_url, quantity: i.quantity, id: i.menu_item.id, price: `AED ${parseFloat(i.menu_item.price).toFixed(2)}` });
            });
            setWeekMenu(wk);
          }
          dispatch(syncLocalCart(cart.items || []));
          return;
        }
      } catch { }

      // Fallback: load location from storage
      const loc = await getSelectedLocation();
      if (loc?.location) {
        setPickupLocation(`${loc.location.name}, ${loc.location.info}`);
        setLocationId(loc.location.id);
        setActiveStep(2);
        setMaxCompleted(1);
      }
    };
    restore();
  }, []);

  // Load location on mount
  useEffect(() => {
    getSelectedLocation().then(loc => {
      if (loc?.location) {
        setPickupLocation(`${loc.location.name}, ${loc.location.info}`);
        setLocationId(Number(loc.location.id) || 1);
      }
    });
  }, []);

  // Machine goods with 5-min cache
  useEffect(() => {
    const fetch_ = async () => {
      const loc = await getSelectedLocation();
      const sn  = loc?.location?.serial_number;
      if (!sn) { setMachineGoods([]); return; }

      const cached = await getMachineGoodsCache(sn);
      if (cached) {
        const { goods, shelves, timestamp } = cached;
        const expired = Date.now() - timestamp > 5 * 60 * 1000;
        if (goods?.length > 0) {
          setMachineGoods(goods);
          if (shelves) setMachineShelves(shelves);
          if (!expired) return;
        }
      }
      try {
        const res  = await fetch(`${BASE_URL}/api/vending/external/machine-goods/?machineUuid=${sn}`);
        const data = await res.json();
        if (data?.data) {
          const allGoods = data.data.flatMap((c: any) => c.goodsList || []);
          setMachineGoods(allGoods);
          if (data.shelves) setMachineShelves(data.shelves);
          await setMachineGoodsCache(sn, { goods: allGoods, shelves: data.shelves || null, timestamp: Date.now() });
        } else setMachineGoods([]);
      } catch { setMachineGoods([]); }
    };
    fetch_();
  }, []);

  // Plan types
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const token = await getAuthToken();
        const res = await axios.get(`${BASE_URL}/api/vending/plan-types/`, { headers: token ? { Authorization: `Token ${token}` } : {} });
        setPlanTypeOptions(res.data?.options || []);
      } catch { }
    };
    fetch_();
  }, []);

  // Pickup options
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const loc = await getSelectedLocation();
        const locId = Number(loc?.location?.id) || 1;
        const token = await getAuthToken();
        const res = await axios.get(`${BASE_URL}/api/vending/pickup-options/?location_id=${locId}`, { headers: token ? { Authorization: `Token ${token}` } : {} });
        setPickupOptions(res.data?.pickup_types || []);
        setTimeSlots(res.data?.time_slots || []);
      } catch { }
    };
    fetch_();
  }, []);

  // Plan subtypes
  useEffect(() => {
    if (orderType !== 'Start a Plan') return;
    const fetch_ = async () => {
      try {
        const token = await getAuthToken();
        const res = await axios.get(`${BASE_URL}/api/vending/plan-options/`, { headers: token ? { Authorization: `Token ${token}` } : {} });
        setPlanSubTypes(res.data?.plan_subtypes || []);
      } catch { }
    };
    fetch_();
  }, [orderType]);

  // Order Now menu
  useEffect(() => {
    if (orderType !== 'Order Now' || activeStep < 4) return;
    const fetch_ = async () => {
      setMenuLoading(true);
      try {
        const token = await getAuthToken();
        const res = await fetch(`${BASE_URL}/api/vending/menu/ORDER_NOW/`, {
          headers: { 'Content-Type': 'application/json', Authorization: `token ${token || ''}` },
        });
        const data = await res.json();
        const imageMap: Record<string, string> = {};
        data.menus?.forEach((m: any) => m.items?.forEach((it: any) => {
          if (it.image_url && !imageMap[it.name]) imageMap[it.name] = it.image_url;
        }));
        const allItems: any[] = [];
        data.menus?.forEach((m: any) => m.items?.forEach((it: any) => {
          allItems.push({ imgSrc: imageMap[it.name] || it.image_url, heading: it.name, imgAlt: `food-${it.id}`, description: it.description, price: `AED ${parseFloat(it.price).toFixed(2)}`, id: it.id });
        }));
        setApiOrderNowMenu(allItems);
      } catch { } finally { setMenuLoading(false); }
    };
    fetch_();
  }, [orderType, activeStep]);

  // Weekly/Monthly menu
  useEffect(() => {
    if (orderType !== 'Start a Plan' || activeStep < 4) return;
    const fetch_ = async () => {
      setMenuLoading(true);
      try {
        const token = await getAuthToken();
        const hdrs  = token ? { Authorization: `Token ${token}` } : {};
        if (planType === 'weekly') {
          const res = await axios.get(`${BASE_URL}/api/vending/menu/plan/WEEKLY/`, { headers: hdrs });
          setApiWeeklyMenu(res.data);
        } else if (planType === 'monthly') {
          const res = await axios.get(`${BASE_URL}/api/vending/menu/plan/MONTHLY/`, { headers: hdrs });
          // Match web: store the month_menu array directly so [wk-1].menu indexing works.
          setApiMonthlyMenu(res.data?.month_menu || null);
        }
      } catch { } finally { setMenuLoading(false); }
    };
    fetch_();
  }, [orderType, planType, activeStep]);

  // Smart grab available items (from machine goods)
  const smartGrabAvailableItems = useMemo(() => {
    if (!machineGoods || machineGoods.length === 0) return [];
    return machineGoods.map((good: any) => ({
      id: good.uuid,
      heading: (good.goodsName || '').replace(/\*/g, '').trim(),
      price: `AED ${parseFloat(good.goodsPrice || '0').toFixed(2)}`,
      imgSrc: good.goodsUrl ? `http://pic.hnzczy.cn/${good.goodsUrl}` : '',
      imgAlt: good.goodsName,
      description: good.goodsDesc || '',
      vendingGoodUuid: good.uuid,
      locked: good.locked || false,
      presentNumber: good.presentNumber || 0,
    }));
  }, [machineGoods]);

  // Order Now items enriched with machine availability — mirrors web Menu.tsx
  // useMemo. Builds shelfData (shelf-organized cards), availableItems (flat
  // fallback when no shelves), otherItems (not in machine), and a count.
  const { availableItems, otherItems, shelfData, totalAvailableCount } = useMemo(() => {
    if (machineGoods === null) {
      return { availableItems: [], otherItems: apiOrderNowMenu, shelfData: [], totalAvailableCount: 0 };
    }
    if (machineGoods.length === 0) {
      return { availableItems: [], otherItems: apiOrderNowMenu, shelfData: [], totalAvailableCount: 0 };
    }

    const available: any[] = [];
    const others: any[]    = [];

    // Lookup menu items by normalized name (web's foodLookup)
    const foodLookup = new Map<string, any>();
    apiOrderNowMenu.forEach((item: any) =>
      foodLookup.set(normalizeName(item.heading), item),
    );

    // Process machineShelves: enrich each spot with its menu item
    const processedShelves = (machineShelves || [])
      .map((shelf: any) => ({
        ...shelf,
        spots: (shelf.spots || []).map((spot: any) => {
          if (!spot.goods) return { ...spot, enrichedItem: null };
          const normalizedName = normalizeName(spot.goods.goodsName);
          const menuItem = foodLookup.get(normalizedName);
          if (menuItem) {
            return {
              ...spot,
              enrichedItem: {
                ...menuItem,
                vendingGoodUuid: spot.goods.uuid,
                quantity: 1,
                availableQuantity: spot.presentNumber,
                locked: spot.goods.locked || false,
              },
            };
          }
          return { ...spot, enrichedItem: null };
        }),
      }))
      // Web rule: keep shelves that have at least one in-stock spot
      .filter((shelf: any) =>
        shelf.spots.some(
          (s: any) => s.enrichedItem !== null && s.presentNumber > 0,
        ),
      );

    // Build flat available/others lists (used when no shelves data)
    apiOrderNowMenu.forEach((item: any) => {
      const normItem = normalizeName(item.heading);
      let matchedUuid: string | undefined;
      const isAvailable = machineGoods.some((good: any) => {
        const rawName = typeof good === 'string' ? good : good?.goodsName || '';
        if (normalizeName(rawName) === normItem) {
          matchedUuid = typeof good === 'object' ? good.uuid : undefined;
          if (typeof good === 'object' && good.presentNumber !== undefined && good.presentNumber <= 0) {
            return false;
          }
          return true;
        }
        return false;
      });

      const enriched = { ...item, vendingGoodUuid: matchedUuid };
      if (isAvailable) available.push(enriched);
      else             others.push(enriched);
    });

    const uniqueAvailable = Array.from(
      new Map(available.map((i: any) => [i.heading, i])).values(),
    );
    const availableNames = new Set(uniqueAvailable.map((i: any) => i.heading));
    const uniqueOthers = Array.from(
      new Map(
        others
          .filter((i: any) => !availableNames.has(i.heading))
          .map((i: any) => [i.heading, i]),
      ).values(),
    );

    const totalCount = processedShelves.length > 0
      ? processedShelves.reduce(
          (acc: number, shelf: any) =>
            acc +
            shelf.spots.filter(
              (s: any) => s.enrichedItem !== null && s.presentNumber > 0,
            ).length,
          0,
        )
      : uniqueAvailable.length;

    return {
      // When shelves exist, web hides the flat availableItems list
      availableItems:    processedShelves.length > 0 ? [] : uniqueAvailable,
      otherItems:        uniqueOthers,
      shelfData:         processedShelves,
      totalAvailableCount: totalCount,
    };
  }, [apiOrderNowMenu, machineGoods, machineShelves]);

  // ── Floating bottom bar (web "Sticky Footer Mobile") ─────────────────────────
  // Shows on the active step 4+ with the running cart count and a primary
  // "Confirm and review" CTA. Visible across all order types.
  const totalMealsInStep = useMemo(() => {
    if (orderType === 'Order Now')  return orderNowMenu.reduce((a, i) => a + (i.quantity || 1), 0);
    if (orderType === 'Smart Grab') return smartGrabMenu.reduce((a, i) => a + (i.quantity || 1), 0);
    if (orderType === 'Start a Plan' && planType === 'weekly') {
      return DAYS.reduce((a, d) => a + (weekMenu[d]?.length || 0), 0);
    }
    if (orderType === 'Start a Plan' && planType === 'monthly') {
      const wm = activeStep === 4 ? weekMenu1
              : activeStep === 5 ? weekMenu2
              : activeStep === 6 ? weekMenu3
              : weekMenu4;
      return DAYS.reduce((a, d) => a + (wm[d]?.length || 0), 0);
    }
    return 0;
  }, [orderType, planType, activeStep, orderNowMenu, smartGrabMenu, weekMenu, weekMenu1, weekMenu2, weekMenu3, weekMenu4]);

  const handleResetCart = useCallback(() => {
    Alert.alert(
      'Reset Menu Selection?',
      'Are you sure you want to reset your menu selection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (orderType === 'Order Now')  setOrderNowMenu([]);
            else if (orderType === 'Smart Grab') setSmartGrabMenu([]);
            else if (orderType === 'Start a Plan' && planType === 'weekly')  setWeekMenu({});
            else if (orderType === 'Start a Plan' && planType === 'monthly') {
              if (activeStep === 4) setWeekMenu1({});
              if (activeStep === 5) setWeekMenu2({});
              if (activeStep === 6) setWeekMenu3({});
              if (activeStep === 7) setWeekMenu4({});
            }
          },
        },
      ],
    );
  }, [orderType, planType, activeStep]);

  // ── handleConfirmStep — POST /api/vending/cart/ ──────────────────────────────
  const handleConfirmStep = useCallback(async () => {
    const isMonthly = orderType === 'Start a Plan' && planType === 'monthly';
    const isWeekly  = orderType === 'Start a Plan' && planType === 'weekly';
    const lastStep  = isMonthly ? 7 : 4;
    const isLast    = activeStep === lastStep;

    const loc = await getSelectedLocation();
    const locId = Number(loc?.location?.id) || locationId || 1;

    let items: any[] = [];

    const buildItem = (item: any, dayOfWeek: string | null, weekNum: number | null) => ({
      // Stable per-day-and-week id so CartScreen handlers (which key by
      // `item.id`) can reliably find/update/delete this row. The authed path
      // gets server-assigned ids; guests use this synthetic one.
      id:               Math.floor(Math.random() * 1_000_000_000),
      menu_item_id:     item.id,
      quantity:         item.quantity || 1,
      day_of_week:      dayOfWeek,
      week_number:      weekNum,
      vending_good_uuid:item.vendingGoodUuid || null,
      pickup_slot_id:   weekNum && dayOfWeek ? (dayPickupSlots?.[`${weekNum}-${dayOfWeek}`] || null) : null,
      // Include the nested menu_item object so the guest path has enough
      // data to render the cart screen. The authed path doesn't need it
      // (the backend hydrates it on POST), but for guests this payload
      // goes straight to AsyncStorage and CartScreen.mapCartToUI filters
      // out any item without `menu_item` set.
      menu_item: {
        id:          item.id,
        name:        item.heading || item.name || 'Item',
        price:       (item.price || '0').toString().replace('AED ', '').trim(),
        image_url:   item.imgSrc || item.image_url || '',
        description: item.description || '',
        heating:     item.heating || 'no',
      },
    });

    if (orderType === 'Order Now') {
      items = orderNowMenu.map(i => buildItem(i, null, null));
    } else if (orderType === 'Smart Grab') {
      items = smartGrabMenu.map(i => buildItem(i, null, null));
    } else if (isWeekly) {
      DAYS.forEach(day => (weekMenu[day] || []).forEach((i: any) => items.push(buildItem(i, day, 1))));
    } else if (isMonthly && isLast) {
      const processWeek = (wm: any, wn: number) =>
        DAYS.forEach(day => (wm?.[day] || []).forEach((i: any) => items.push(buildItem(i, day, wn))));
      processWeek(weekMenu1, 1); processWeek(weekMenu2, 2);
      processWeek(weekMenu3, 3); processWeek(weekMenu4, 4);
      // Consolidate duplicates
      const km = new Map<string, any>();
      items.forEach(it => {
        const k = `${it.menu_item_id}-${it.day_of_week}-${it.week_number}`;
        km.has(k) ? km.get(k).quantity += it.quantity : km.set(k, { ...it });
      });
      items = Array.from(km.values());
    } else if (isMonthly) {
      const wm = activeStep === 4 ? weekMenu1 : activeStep === 5 ? weekMenu2 : activeStep === 6 ? weekMenu3 : weekMenu4;
      const wn = activeStep - 3;
      DAYS.forEach(day => (wm?.[day] || []).forEach((i: any) => items.push(buildItem(i, day, wn))));
    }

    const slot   = timeSlots.find((s: any) => s.label === time);
    const payload: any = {
      location_id:    Number(locId),
      plan_type:      orderType === 'Start a Plan' ? 'START_PLAN' : orderType === 'Smart Grab' ? 'SMART_GRAB' : 'ORDER_NOW',
      plan_subtype:   orderType === 'Start a Plan' && planType ? planType.toUpperCase() : 'NONE',
      pickup_type:    pickOrder?.includes('24') ? 'IN_24_HOURS' : 'TODAY',
      pickup_date:    new Date().toISOString().split('T')[0],
      pickup_slot_id: slot?.id ? Number(slot.id) : null,
      items,
      current_step:   activeStep + 1,
    };

    // ⚡ Advance the step UI IMMEDIATELY so the user always sees forward
    // motion when they tap Confirm. The cart sync below is best-effort —
    // a network error must not leave the user stuck on the current step.
    if (!isLast) {
      setMaxCompleted(activeStep);
      setActiveStep(activeStep + 1);
    }

    setLoading(true);
    let apiSaved = true;
    try {
      const token = await getAuthToken();
      if (token) {
        try {
          await axios.post(
            `${BASE_URL}/api/vending/cart/`,
            payload,
            { headers: { Authorization: `Token ${token}` } },
          );
        } catch (err) {
          apiSaved = false;
          console.warn('Cart sync failed:', err);
        }
      } else {
        try {
          await setGuestCart(payload);
          dispatch(syncLocalCart(payload.items || []));
        } catch (err) {
          apiSaved = false;
          console.warn('Guest cart save failed:', err);
        }
      }

      // Last step: only navigate to Cart if the cart was actually saved.
      if (isLast) {
        if (apiSaved) {
          navigation.navigate('Cart');
        } else {
          Alert.alert('Error', 'Failed to save cart. Please try again.');
        }
      }
    } catch (err) {
      console.warn('handleConfirmStep unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeStep, orderType, planType, pickOrder, time, timeSlots, locationId,
      orderNowMenu, smartGrabMenu, weekMenu, weekMenu1, weekMenu2, weekMenu3, weekMenu4,
      dayPickupSlots, navigation, dispatch]);

  // ── Render ────────────────────────────────────────────────────────────────────
  const isMonthly = orderType === 'Start a Plan' && planType === 'monthly';
  const isWeekly  = orderType === 'Start a Plan' && planType === 'weekly';

  const step1Status = getStepStatus(1);
  const step2Status = getStepStatus(2);
  const step3Status = getStepStatus(3);
  const step4Status = getStepStatus(4);

  return (
    <View style={[main.screen, { paddingTop: insets.top }]}>
      <Header variant="vending" />

      {/* Page title */}
      <View style={main.titleArea}>
        <BreadCrumb />
        <Text style={main.pageTitle}>Vending Pickup</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          // Reserve room for the floating bar only when it's actually rendered
          // (Order Now / Smart Grab on step 4+). Weekly/Monthly use inline buttons.
          paddingBottom:
            step4Status !== 'pending' &&
            (orderType === 'Order Now' || orderType === 'Smart Grab')
              ? 200
              : 32,
        }}
        showsVerticalScrollIndicator={false}>

        {/* ── STEP 1: Pickup Location ─────────────────────────── */}
        <StepCard status={step1Status}>
          <View style={s.stepRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <StepCircle n={1} status={step1Status} />
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Select Pickup Location</Text>
                  {pickupLocation !== 'no location selected' && (
                    <Text style={s.stepSummary}>"{pickupLocation}"</Text>
                  )}
                </View>
              </View>
            </View>
            {step1Status === 'completed' ? (
              <TouchableOpacity style={s.editBtn} onPress={() => navigation.navigate('VendingHome')}>
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : step1Status === 'active' && (
              <TouchableOpacity
                style={[s.confirmBtn, pickupLocation === 'no location selected' && s.confirmBtnGray]}
                onPress={() => {
                  if (pickupLocation !== 'no location selected') {
                    setActiveStep(2); setMaxCompleted(1);
                  } else { navigation.navigate('VendingHome'); }
                }}>
                <Text style={s.confirmBtnText}>
                  {pickupLocation !== 'no location selected' ? 'Continue' : 'Select Location'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </StepCard>

        {/* ── STEP 2: Order Type ──────────────────────────────── */}
        <StepCard status={step2Status}>
          <View style={s.stepRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <StepCircle n={2} status={step2Status} />
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Choose How You'd Like to Order</Text>
                  {step2Status === 'completed' && (
                    <Text style={s.stepSummary}>"{orderType === 'Start a Plan' ? planType : orderType}"</Text>
                  )}
                </View>
              </View>
            </View>
            {step2Status === 'completed' && (
              <TouchableOpacity style={s.editBtn} onPress={() => handleEditStep(2)}>
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {step2Status === 'active' && (
            <View style={{ marginTop: 16, gap: 16 }}>
              {/* Order type buttons */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(planTypeOptions.length > 0 ? planTypeOptions : [
                  { key: 'order_now', label: 'Order Now' },
                  { key: 'smart_grab', label: 'Smart Grab' },
                  { key: 'start_plan', label: 'Start a Plan' },
                ]).map((opt: any) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.typeBtn, orderType === opt.label && s.typeBtnActive]}
                    onPress={() => { setOrderType(opt.label); setPlanType(''); }}>
                    <Text style={[s.typeBtnText, orderType === opt.label && s.typeBtnTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.descText}>
                {orderType === 'Start a Plan'
                  ? 'Select a plan to get started with your weekly or monthly meal planning.'
                  : "Today's Menu, Ready to Go! Freshly made meals, available to pickup within 24 hours."}
              </Text>

              {/* Plan subtype */}
              {orderType === 'Start a Plan' && (
                <View style={{ gap: 8 }}>
                  <Text style={s.subHeader}>Select a plan to get started</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(planSubTypes.length > 0 ? planSubTypes : [
                      { key: 'weekly', label: 'Weekly' },
                      { key: 'monthly', label: 'Monthly' },
                    ]).map((opt: any) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[s.typeBtn, planType === String(opt.key).toLowerCase() && s.typeBtnActive]}
                        onPress={() => setPlanType(String(opt.key).toLowerCase())}>
                        <Text style={[s.typeBtnText, planType === String(opt.key).toLowerCase() && s.typeBtnTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[s.primaryBtn, !orderType && s.primaryBtnDisabled]}
                onPress={() => {
                  if (!orderType) return;
                  // Step 2 → Step 3: set default pickup
                  if (orderType === 'Start a Plan' && !pickOrder) setPickOrder('Pickup Today');
                  setMaxCompleted(2); setActiveStep(3);
                }}
                disabled={!orderType || (orderType === 'Start a Plan' && !planType)}>
                <Text style={s.primaryBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
        </StepCard>

        {/* ── STEP 3: Pickup Time ─────────────────────────────── */}
        <StepCard status={step3Status}>
          <View style={s.stepRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <StepCircle n={3} status={step3Status} />
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Set Your Pickup Time</Text>
                  {step3Status === 'completed' && (
                    <>
                      {orderType !== 'Start a Plan' && <Text style={s.stepSummary}>"{pickOrder}"</Text>}
                      {time ? <Text style={s.stepSummary}>"{time}"</Text> : null}
                    </>
                  )}
                </View>
              </View>
            </View>
            {step3Status === 'completed' && (
              <TouchableOpacity style={s.editBtn} onPress={() => handleEditStep(3)}>
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {step3Status === 'active' && (
            <View style={{ marginTop: 16, gap: 12 }}>
              {/* Pickup type buttons (not for Start a Plan) */}
              {orderType !== 'Start a Plan' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(pickupOptions.length > 0
                    ? pickupOptions.filter((o: any) => !(orderType === 'Order Now' && o.label === 'Pickup Today'))
                    : [{ key: 'in_24', label: 'Pickup in 24 hours' }]
                  ).map((opt: any) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[s.typeBtn, pickOrder === opt.label && s.typeBtnActive]}
                      onPress={() => setPickOrder(opt.label)}>
                      <Text style={[s.typeBtnText, pickOrder === opt.label && s.typeBtnTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={s.descText}>Select a timeframe to pickup your meal</Text>
              <Text style={[s.descText, { fontSize: 12, color: Colors.neutralGray }]}>
                Sub copy if needed
              </Text>

              {/* Web step 3 has a single CTA — "Select Timeframe" — that opens
                  the sidebar. The sidebar's own Confirm advances the step,
                  so there's no duplicate Confirm here. */}
              <TouchableOpacity style={s.primaryBtn} onPress={() => setShowTimeModal(true)}>
                <Text style={s.primaryBtnText}>Select Timeframe</Text>
              </TouchableOpacity>
            </View>
          )}
        </StepCard>

        {/* ── STEP 4: Choose Your Meal ─────────────────────────── */}

        {/* Order Now */}
        {orderType === 'Order Now' && (
          <StepCard status={step4Status}>
            <View style={s.stepRow}>
              <View style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <StepCircle n={4} status={step4Status} />
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Choose Your Meal</Text>
                  {step4Status === 'completed' && (() => {
                    const { totalMeals, line } = generateCartSummary(orderNowMenu);
                    return <><Text style={s.stepSummary}>"{totalMeals} Meals"</Text><Text style={s.stepSummary}>{line}</Text></>;
                  })()}
                </View>
              </View>
              {step4Status === 'completed' && (
                <TouchableOpacity style={s.editBtn} onPress={() => handleEditStep(4)}>
                  <Text style={s.editBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
            {step4Status === 'active' && (
              <View style={{ marginTop: 12 }}>
                {/* Header text — web Menu mobile copy */}
                <Text style={s.menuHeader}>Choose Your Meal</Text>
                <Text style={s.menuSubHeader}>
                  Choose your meal from our daily menu of {totalAvailableCount} chef-prepared meals
                </Text>
                {machineGoods === null && (
                  <Text style={s.checkingText}>Checking availability…</Text>
                )}

                {menuLoading ? <Shimmer /> : (
                  <>
                    {/* SHELF-ORGANIZED LAYOUT — primary path, matches web exactly */}
                    {shelfData.length > 0 ? (
                      shelfData.map((shelf: any) => (
                        <View key={shelf.shelfIndex} style={s.shelfSection}>
                          <View style={s.shelfHeader}>
                            <View style={s.shelfAccent} />
                            <Text style={s.shelfName}>{shelf.shelfName}</Text>
                          </View>
                          {/* Web: grid grid-cols-2 gap-[12px] — 2 cards per row */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                            {shelf.spots
                              .filter((spot: any) => spot.enrichedItem !== null)
                              .map((spot: any, idx: number) => {
                                const data      = spot.enrichedItem;
                                const isSoldOut = spot.presentNumber <= 0;
                                const isLocked  = spot.goods?.locked || false;
                                const qty       = orderNowMenu.find(i => i.id === data.id)?.quantity || 0;

                                return (
                                  // Width belongs on the wrapper so flex-wrap
                                  // knows each item is half-width — the FoodCard
                                  // itself fills the wrapper.
                                  <View key={idx} style={{ position: 'relative', width: '47.5%' }}>
                                    {/* Spot N badge — web bg-[#054A86] -top-1.5 -left-1.5 */}
                                    <View style={s.spotBadge}>
                                      <Text style={s.spotBadgeText}>Spot {spot.arrivalName}</Text>
                                    </View>
                                    <FoodCard
                                      item={data}
                                      qty={qty}
                                      isSoldOut={isSoldOut}
                                      isLocked={isLocked}
                                      onAdd={() => {
                                        if (isSoldOut || isLocked) return;
                                        setOrderNowMenu(prev => {
                                          const i = prev.findIndex(p => p.id === data.id);
                                          return i >= 0
                                            ? prev.map((p, j) => j === i ? { ...p, quantity: p.quantity + 1 } : p)
                                            : [...prev, { ...data, quantity: 1 }];
                                        });
                                      }}
                                      onRemove={() => setOrderNowMenu(prev => {
                                        const i = prev.findIndex(p => p.id === data.id);
                                        if (i < 0) return prev;
                                        const newQ = prev[i].quantity - 1;
                                        return newQ <= 0
                                          ? prev.filter((_, j) => j !== i)
                                          : prev.map((p, j) => j === i ? { ...p, quantity: newQ } : p);
                                      })}
                                      onPress={() => !isLocked && !isSoldOut && setSelectedItem(data)}
                                    />
                                    {/* "Only N left" badge — web shows when stock < 5 */}
                                    {!isSoldOut && !isLocked && spot.presentNumber > 0 && spot.presentNumber < 5 && (
                                      <View style={s.stockBadge}>
                                        <Text style={s.stockBadgeText}>Only {spot.presentNumber} left</Text>
                                      </View>
                                    )}
                                  </View>
                                );
                              })}
                          </View>
                        </View>
                      ))
                    ) : machineGoods !== null ? (
                      /* Machine loaded but no shelves match — web's "No Items" empty state */
                      <View style={s.emptyShelf}>
                        <View style={s.emptyShelfIconWrap}>
                          <X size={48} color="#D1D5DB" />
                        </View>
                        <Text style={s.emptyShelfTitle}>No Items Available</Text>
                        <Text style={s.emptyShelfMsg}>
                          Sorry, there are no items currently available at this location.
                        </Text>
                      </View>
                    ) : (
                      /* Fallback: machine API not configured — show flat list */
                      <>
                        {availableItems.length > 0 && (
                          <>
                            <Text style={s.subHeader}>Available Now ({availableItems.length})</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                              {availableItems.map((item: any) => {
                                const qty = orderNowMenu.find(i => i.id === item.id)?.quantity || 0;
                                return (
                                  <View key={item.id} style={{ width: '48%' }}>
                                    <FoodCard
                                      item={item} qty={qty}
                                      onAdd={() => setOrderNowMenu(prev => {
                                        const i = prev.findIndex(p => p.id === item.id);
                                        return i >= 0 ? prev.map((p, j) => j === i ? { ...p, quantity: p.quantity + 1 } : p) : [...prev, { ...item, quantity: 1 }];
                                      })}
                                      onRemove={() => setOrderNowMenu(prev => {
                                        const i = prev.findIndex(p => p.id === item.id);
                                        if (i < 0) return prev;
                                        const newQ = prev[i].quantity - 1;
                                        return newQ <= 0 ? prev.filter((_, j) => j !== i) : prev.map((p, j) => j === i ? { ...p, quantity: newQ } : p);
                                      })}
                                      onPress={() => setSelectedItem(item)}
                                    />
                                  </View>
                                );
                              })}
                            </View>
                          </>
                        )}
                        {otherItems.length > 0 && (
                          <>
                            <Text style={s.subHeader}>All Menu Items</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                              {otherItems.map((item: any) => {
                                const qty = orderNowMenu.find(i => i.id === item.id)?.quantity || 0;
                                return (
                                  <View key={item.id} style={{ width: '48%' }}>
                                    <FoodCard
                                      item={item} qty={qty}
                                      onAdd={() => setOrderNowMenu(prev => {
                                        const i = prev.findIndex(p => p.id === item.id);
                                        return i >= 0 ? prev.map((p, j) => j === i ? { ...p, quantity: p.quantity + 1 } : p) : [...prev, { ...item, quantity: 1 }];
                                      })}
                                      onRemove={() => setOrderNowMenu(prev => {
                                        const i = prev.findIndex(p => p.id === item.id);
                                        if (i < 0) return prev;
                                        const newQ = prev[i].quantity - 1;
                                        return newQ <= 0 ? prev.filter((_, j) => j !== i) : prev.map((p, j) => j === i ? { ...p, quantity: newQ } : p);
                                      })}
                                      onPress={() => setSelectedItem(item)}
                                    />
                                  </View>
                                );
                              })}
                            </View>
                          </>
                        )}
                      </>
                    )}

                    {/* Confirm CTA lives in the floating bar at the bottom */}
                  </>
                )}
              </View>
            )}
          </StepCard>
        )}

        {/* Smart Grab */}
        {orderType === 'Smart Grab' && (
          <StepCard status={step4Status}>
            <View style={s.stepRow}>
              <View style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <StepCircle n={4} status={step4Status} />
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Choose Your Meal</Text>
                  {step4Status === 'completed' && (() => {
                    const { totalMeals, line } = generateCartSummary(smartGrabMenu);
                    return <><Text style={s.stepSummary}>"{totalMeals} Meals"</Text><Text style={s.stepSummary}>{line}</Text></>;
                  })()}
                </View>
              </View>
              {step4Status === 'completed' && (
                <TouchableOpacity style={s.editBtn} onPress={() => handleEditStep(4)}><Text style={s.editBtnText}>Edit</Text></TouchableOpacity>
              )}
            </View>
            {step4Status === 'active' && (
              <View style={{ marginTop: 12 }}>
                {machineGoods === null ? <Shimmer /> : smartGrabAvailableItems.length === 0 ? (
                  <Text style={{ color: Colors.neutralGray, textAlign: 'center', padding: 24 }}>No items currently available in this machine.</Text>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                      {smartGrabAvailableItems.map((item: any) => {
                        const qty = smartGrabMenu.find(i => i.id === item.id)?.quantity || 0;
                        const isSoldOut = (item.presentNumber !== undefined && item.presentNumber <= 0);
                        return (
                          <View key={item.id} style={{ width: '48%' }}>
                            <FoodCard
                              item={item} qty={qty}
                              isSoldOut={isSoldOut} isLocked={item.locked}
                              onAdd={() => !isSoldOut && !item.locked && setSmartGrabMenu(prev => {
                                const idx = prev.findIndex(i => i.id === item.id);
                                return idx >= 0 ? prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...item, quantity: 1 }];
                              })}
                              onRemove={() => setSmartGrabMenu(prev => {
                                const idx = prev.findIndex(i => i.id === item.id);
                                if (idx < 0) return prev;
                                const newQ = prev[idx].quantity - 1;
                                return newQ <= 0 ? prev.filter((_, j) => j !== idx) : prev.map((i, j) => j === idx ? { ...i, quantity: newQ } : i);
                              })}
                              onPress={() => {}}
                            />
                          </View>
                        );
                      })}
                    </View>
                    {/* Confirm CTA lives in the floating bar at the bottom */}
                  </>
                )}
              </View>
            )}
          </StepCard>
        )}

        {/* Weekly Plan */}
        {isWeekly && (
          <StepCard status={step4Status}>
            <View style={s.stepRow}>
              <View style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <StepCircle n={4} status={step4Status} />
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>Plan Your Week Menu</Text>
                  {step4Status === 'completed' && (() => {
                    const { totalMeals, lines } = generatePlanSummary(weekMenu);
                    return <><Text style={s.stepSummary}>"{totalMeals} Meals"</Text>{lines.map((l, i) => <Text key={i} style={s.stepSummary}>{l}</Text>)}</>;
                  })()}
                </View>
              </View>
              {step4Status === 'completed' && (
                <TouchableOpacity style={s.editBtn} onPress={() => handleEditStep(4)}><Text style={s.editBtnText}>Edit</Text></TouchableOpacity>
              )}
            </View>
            {step4Status === 'active' && (
              <View style={{ marginTop: 12 }}>
                {menuLoading ? <Shimmer /> : (
                  <WeeklyPlanPicker
                    apiMenuData={apiWeeklyMenu}
                    weekPlan={weekMenu}
                    setWeekPlan={setWeekMenu}
                    weekNumber={1}
                    timeSlots={timeSlots}
                    dayPickupSlots={dayPickupSlots}
                    setDayPickupSlots={setDayPickupSlots}
                    defaultSlotId={timeSlots.find((sl: any) => sl.label === time)?.id || null}
                    onItemPress={(item: any) => setSelectedItem(item)}
                    onConfirm={handleConfirmStep}
                    onReset={handleResetCart}
                    loading={loading}
                  />
                )}
              </View>
            )}
          </StepCard>
        )}

        {/* Monthly Plan (4 weeks) */}
        {isMonthly && [1, 2, 3, 4].map(wk => {
          const stepNum = wk + 3;
          const wkStatus = getStepStatus(stepNum);
          const wkMenu   = wk === 1 ? weekMenu1 : wk === 2 ? weekMenu2 : wk === 3 ? weekMenu3 : weekMenu4;
          const setWkMenu = wk === 1 ? setWeekMenu1 : wk === 2 ? setWeekMenu2 : wk === 3 ? setWeekMenu3 : setWeekMenu4;
          return (
            <StepCard key={wk} status={wkStatus}>
              <View style={s.stepRow}>
                <View style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                  <StepCircle n={stepNum} status={wkStatus} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.stepTitle}>Plan Your Week {wk} Menu</Text>
                    {wkStatus === 'completed' && (() => {
                      const { totalMeals, lines } = generatePlanSummary(wkMenu);
                      return <><Text style={s.stepSummary}>"{totalMeals} Meals"</Text>{lines.slice(0, 3).map((l, i) => <Text key={i} style={s.stepSummary}>{l}</Text>)}</>;
                    })()}
                  </View>
                </View>
                {wkStatus === 'completed' && (
                  <TouchableOpacity style={s.editBtn} onPress={() => handleEditStep(stepNum)}><Text style={s.editBtnText}>Edit</Text></TouchableOpacity>
                )}
              </View>
              {wkStatus === 'active' && (
                <View style={{ marginTop: 12 }}>
                  {menuLoading ? <Shimmer /> : (
                    <WeeklyPlanPicker
                      // Web pattern: apiMonthlyMenu is the month_menu array;
                      // pass the per-week entry so the picker can unwrap .menu.
                      apiMenuData={apiMonthlyMenu?.[wk - 1] || null}
                      weekPlan={wkMenu}
                      setWeekPlan={setWkMenu}
                      weekNumber={wk}
                      timeSlots={timeSlots}
                      dayPickupSlots={dayPickupSlots}
                      setDayPickupSlots={setDayPickupSlots}
                      defaultSlotId={timeSlots.find((sl: any) => sl.label === time)?.id || null}
                      onItemPress={(item: any) => setSelectedItem(item)}
                      onConfirm={handleConfirmStep}
                      onReset={handleResetCart}
                      loading={loading}
                    />
                  )}
                </View>
              )}
            </StepCard>
          );
        })}

      </ScrollView>

      {/* Time slot sidebar — slides in from the right (web pattern, identical
          to the Vending Locator sidebar). Selecting a slot only highlights
          it; tapping the sticky "Confirm" button advances the step. */}
      <Modal
        visible={showTimeModal}
        transparent
        animationType="none"
        onRequestClose={() => setShowTimeModal(false)}
        statusBarTranslucent>
        <View style={ts.backdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setShowTimeModal(false)}
          />
          <View style={ts.panelWrap} pointerEvents="box-none">
            <MotiView
              from={{ translateX: W }}
              animate={{ translateX: 0 }}
              exit={{ translateX: W }}
              transition={{ type: 'spring', stiffness: 250, damping: 30 }}
              style={[ts.panel, { paddingTop: insets.top }]}>

              {/* Header — web mobile: text-[20px] leading-[24px] font-[600] */}
              <View style={ts.header}>
                <Text style={ts.headerTitle}>Select a Timeframe</Text>
                <TouchableOpacity
                  style={ts.closeBtn}
                  onPress={() => setShowTimeModal(false)}>
                  <X size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              {/* Slot list — flex:1, scrollable between header and footer */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
                showsVerticalScrollIndicator={false}>
                {(timeSlots.length > 0 ? timeSlots : [
                  { id: 1, label: '8:00 AM – 10:00 AM' },
                  { id: 2, label: '10:00 AM – 12:00 PM' },
                  { id: 3, label: '12:00 PM – 2:00 PM' },
                  { id: 4, label: '2:00 PM – 4:00 PM' },
                ]).map((slot: any) => {
                  const isActive = time === slot.label;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[ts.slot, isActive && ts.slotActive]}
                      onPress={() => setTime(slot.label)}
                      activeOpacity={0.85}>
                      <Text style={[ts.slotText, isActive && ts.slotTextActive]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Sticky footer — Confirm + Close (web pattern) */}
              <View
                style={[
                  ts.footer,
                  { paddingBottom: Math.max(insets.bottom, 16) },
                ]}>
                <TouchableOpacity
                  style={[ts.btnPrimary, !time && ts.btnDisabled]}
                  disabled={!time}
                  onPress={() => {
                    setShowTimeModal(false);
                    handleConfirmStep();
                  }}
                  activeOpacity={0.85}>
                  <Text style={ts.btnPrimaryText}>Confirm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={ts.btnOutline}
                  onPress={() => setShowTimeModal(false)}
                  activeOpacity={0.85}>
                  <Text style={ts.btnOutlineText}>Close</Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          </View>
        </View>
      </Modal>

      {/* Item detail sidebar — slides in from the right (matches web exactly).
          Layout per web Menu.tsx:
            heading + X close → image (h-60) → description → price
            → optional offer/terms → footer with [Close] [+ Add] */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="none"
        onRequestClose={() => setSelectedItem(null)}
        statusBarTranslucent>
        <View style={ts.backdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedItem(null)}
          />
          <View style={ts.panelWrap} pointerEvents="box-none">
            <MotiView
              from={{ translateX: W }}
              animate={{ translateX: 0 }}
              exit={{ translateX: W }}
              transition={{ type: 'spring', stiffness: 250, damping: 30 }}
              style={[ts.panel, { paddingTop: insets.top }]}>

              {/* Header — heading text-[28px] font-[700] + X close (web layout) */}
              <View style={id.header}>
                <Text style={id.headerTitle} numberOfLines={2}>
                  {selectedItem?.heading || selectedItem?.name}
                </Text>
                <TouchableOpacity
                  style={id.closeBtn}
                  onPress={() => setSelectedItem(null)}>
                  <X size={20} color="#4B5563" />
                </TouchableOpacity>
              </View>

              {/* Scrollable body — image, desc, price, offer, terms */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}>
                {/* Detail-panel image — uses `imgSrc2` (image2_url) when
                    available, falling back to the card image. Web parity:
                    `selectedItem.imgSrc2 || selectedItem.imgSrc`. Tap to
                    open the full-screen preview (lightbox). */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => {
                    const uri =
                      selectedItem?.imgSrc2 ||
                      selectedItem?.image2_url ||
                      selectedItem?.imgSrc ||
                      selectedItem?.image_url;
                    if (uri) setLightboxUri(uri);
                  }}>
                  <Image
                    source={{
                      uri:
                        selectedItem?.imgSrc2 ||
                        selectedItem?.image2_url ||
                        selectedItem?.imgSrc ||
                        selectedItem?.image_url,
                    }}
                    style={id.image}
                    contentFit="cover"
                  />
                  <View style={id.previewHint}>
                    <Text style={id.previewHintText}>Tap to preview</Text>
                  </View>
                </TouchableOpacity>

                {/* Body — p-5 space-y-4 in web */}
                <View style={id.body}>
                  {!!selectedItem?.description && (
                    <Text style={id.description}>{selectedItem.description}</Text>
                  )}
                  {/* Price — text-[24px] leading-[32px] font-[700] */}
                  <Text style={id.price}>{selectedItem?.price}</Text>

                  {!!selectedItem?.offer && (
                    <View style={id.offerBlock}>
                      <Text style={id.offerText}>{selectedItem.offer}</Text>
                    </View>
                  )}
                  {!!selectedItem?.terms && (
                    <Text
                      style={id.termsLink}
                      onPress={() => navigation.navigate('Terms')}>
                      Terms & conditions Apply
                    </Text>
                  )}
                </View>
              </ScrollView>

              {/* Footer — Close (outline) + + Add (primary), web pattern */}
              <View
                style={[
                  id.footer,
                  { paddingBottom: Math.max(insets.bottom, 16) },
                ]}>
                <TouchableOpacity
                  style={id.btnOutline}
                  onPress={() => setSelectedItem(null)}
                  activeOpacity={0.85}>
                  <Text style={id.btnOutlineText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={id.btnPrimary}
                  onPress={() => {
                    if (!selectedItem) return;
                    const item: any = selectedItem;

                    // Weekly/Monthly: the picker hands us its state setter
                    // directly. Use a FUNCTIONAL update to avoid any stale
                    // closure capture of the previous weekPlan reference.
                    if (item._ctx === 'weekly' && typeof item._setter === 'function') {
                      const day  = item._day  as string;
                      const week = item._week as number;
                      const itemId = item.id;

                      item._setter((prev: any) => {
                        const safe = prev && typeof prev === 'object' ? prev : {};
                        const curr: any[] = Array.isArray(safe[day]) ? safe[day] : [];
                        const i = curr.findIndex((p: any) => p.id === itemId);
                        const next = [...curr];
                        if (i >= 0) {
                          if (next[i].quantity >= 3) return safe; // 3-meal cap
                          next[i] = { ...next[i], quantity: next[i].quantity + 1 };
                        } else {
                          // Strip the meta props (_ctx/_day/_week/_setter) so
                          // the cart shape stays clean.
                          const { _ctx, _day, _week, _setter, ...clean } = item;
                          next.push({ ...clean, day_of_week: day, week_number: week, quantity: 1 });
                        }
                        return { ...safe, [day]: next };
                      });

                      setSelectedItem(null);
                      return;
                    }

                    // Order Now / Smart Grab — flat cart
                    const list = orderType === 'Smart Grab' ? smartGrabMenu : orderNowMenu;
                    const setList = orderType === 'Smart Grab' ? setSmartGrabMenu : setOrderNowMenu;
                    const i = list.findIndex(p => p.id === selectedItem.id);
                    setList(i >= 0
                      ? list.map((p, j) => j === i ? { ...p, quantity: p.quantity + 1 } : p)
                      : [...list, { ...selectedItem, quantity: 1 }]);
                    setSelectedItem(null);
                  }}
                  activeOpacity={0.85}>
                  <Text style={id.btnPrimaryText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          </View>
        </View>
      </Modal>

      {/* Floating sticky CTA bar — web "fixed bottom-[94px] left-4 right-4".
          Web shows this only for Order Now / Smart Grab on mobile.
          Weekly / Monthly use inline buttons inside the WeeklyPlanPicker. */}
      {step4Status !== 'pending' &&
       (orderType === 'Order Now' || orderType === 'Smart Grab') && (
        <View
          pointerEvents="box-none"
          style={[
            fab.wrap,
            { bottom: 70 + insets.bottom + 8 },
          ]}>
          <View style={fab.bar}>
            <View style={fab.topRow}>
              <View>
                <Text style={fab.statusLabel}>
                  {totalMealsInStep === 0 ? 'No selected meals' : `${totalMealsInStep} SELECTED`}
                </Text>
                <Text style={fab.totalText}>
                  Total: {totalMealsInStep} {totalMealsInStep === 1 ? 'Meal' : 'Meals'}
                </Text>
              </View>
              {totalMealsInStep > 0 && (
                <TouchableOpacity onPress={handleResetCart} hitSlop={8}>
                  <Text style={fab.resetText}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={[fab.confirmBtn, totalMealsInStep === 0 && fab.confirmBtnDisabled]}
              disabled={totalMealsInStep === 0 || loading}
              onPress={handleConfirmStep}
              activeOpacity={0.85}>
              {loading ? (
                <ActivityIndicator color={Colors.neutralWhite} />
              ) : (
                <Text style={[
                  fab.confirmBtnText,
                  totalMealsInStep === 0 && fab.confirmBtnTextDisabled,
                ]}>
                  Confirm and review
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Full-screen image preview — mounted at the screen root so it
          renders above the detail sheet (web parity: lightbox z-[100]
          sits above the sidebar's z-50). */}
      <ImageLightbox
        visible={!!lightboxUri}
        uri={lightboxUri}
        onClose={() => setLightboxUri(null)}
      />

      <MobileFooterNav />
    </View>
  );
}

const main = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: Colors.background },
  titleArea:  { backgroundColor: Colors.neutralWhite, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  pageTitle:  { fontSize: 28, fontWeight: '700', color: Colors.primary, lineHeight: 36, letterSpacing: 0.1 },
});

const s = StyleSheet.create({
  // Step card
  card:       { backgroundColor: Colors.neutralWhite, borderRadius: 16, borderWidth: 1, borderColor: Colors.neutralGrayLightest, padding: 16 },
  cardActive: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  stepRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  stepTitle:  { fontSize: 18, fontWeight: '700', color: Colors.neutralGrayDark, lineHeight: 24 },
  stepSummary:{ fontSize: 16, fontWeight: '700', color: Colors.primaryBlue, lineHeight: 24, marginTop: 2 },
  // Step circle
  circle:     { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  circleBlue: { backgroundColor: Colors.primary },
  circleGreen:{ backgroundColor: '#10B981' },
  circleText: { color: Colors.neutralWhite, fontWeight: '700', fontSize: 13 },
  // Buttons
  editBtn:    { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.neutralGrayDark },
  editBtnText:{ fontSize: 12, fontWeight: '700', color: Colors.neutralGrayDark },
  confirmBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: Colors.primary },
  confirmBtnGray:{ backgroundColor: Colors.neutralGrayLight },
  confirmBtnText:{ fontSize: 13, fontWeight: '700', color: Colors.neutralWhite },
  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primaryBtnDisabled:{ opacity: 0.5 },
  primaryBtnText:{ color: Colors.neutralWhite, fontSize: 14, fontWeight: '700' },
  // Type selector buttons
  typeBtn:      { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.neutralGrayLight, backgroundColor: Colors.neutralWhite },
  typeBtnActive:{ backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  typeBtnText:  { fontSize: 14, fontWeight: '700', color: Colors.neutralBlack },
  typeBtnTextActive:{ color: Colors.neutralBlack },
  descText:   { fontSize: 14, color: Colors.neutralGrayDark, lineHeight: 20 },
  subHeader:  { fontSize: 16, fontWeight: '700', color: Colors.neutralGrayDark, marginBottom: 8 },

  // ── Step 4 Menu header (web Menu mobile header) ──────────────────────────
  // text-[20px] font-bold text-[#054A86]
  menuHeader: { fontSize: 20, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  // text-[#545563] text-[13px] leading-[18px]
  menuSubHeader: { fontSize: 13, color: Colors.neutralGrayDark, lineHeight: 18, marginBottom: 16 },
  checkingText: { fontSize: 12, color: Colors.primary, fontWeight: '500', marginBottom: 16 },

  // ── Shelf section (web bg-gray-50/50 rounded-[24px] p-4 border) ──────────
  shelfSection: {
    backgroundColor: 'rgba(249,250,251,0.5)',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 24,
  },
  shelfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  shelfAccent: {
    width: 8,
    height: 32,
    backgroundColor: Colors.primary,
    borderRadius: 999,
  },
  shelfName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Per-spot badges over the food card ─────────────────────────────────
  // Web: -top-1.5 -left-1.5 bg-[#054A86] px-2 py-1 rounded-full
  spotBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    zIndex: 10,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  spotBadgeText: {
    color: Colors.neutralWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  // Web: top-1.5 right-1.5 bg-orange-500 — "Only N left" warning
  stockBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: Colors.orange,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  stockBadgeText: {
    color: Colors.neutralWhite,
    fontSize: 10,
    fontWeight: '700',
  },

  // ── No-items empty state (web "No Items Available") ─────────────────────
  emptyShelf: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyShelfIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyShelfTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutralBlack,
    marginBottom: 8,
  },
  emptyShelfMsg: {
    fontSize: 14,
    color: '#83859C',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  // Food card — web MOBILE sizing (port of MenuCard.tsx):
  //   border #EDEEF2 → #054A86 when in cart
  //   px-2 pt-2 pb-4, rounded-[12px]
  //   image h-[120px], rounded-[12px]
  //   heading text-[14px] line-clamp-1
  //   desc    text-[11px] line-clamp-2 #83859C
  //   price   text-[13px] (left), qty stepper or + (right)
  // The card itself fills its parent — call sites wrap it in a 48% View
  // so flex-wrap can measure the wrapper and pack two per row.
  foodCard:   {
    width: '100%',
    backgroundColor: Colors.neutralWhite,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest, // #EDEEF2
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  foodCardSelected: {
    borderColor: Colors.primary,             // #054A86 when item is in cart
  },
  foodImgWrap:{ width: '100%', height: 120, position: 'relative', borderRadius: 12, overflow: 'hidden' },
  foodImg:    { width: '100%', height: '100%' },
  foodOverlay:{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  foodBadge:  { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, transform: [{ rotate: '-12deg' }] },
  foodBadgeText:{ color: Colors.neutralWhite, fontSize: 12, fontWeight: '700' },
  foodName:   { fontSize: 14, fontWeight: '700', color: Colors.neutralBlack, paddingTop: 8, paddingBottom: 2, lineHeight: 20, letterSpacing: 0.1 },
  foodDesc:   { fontSize: 11, color: '#83859C', lineHeight: 16, letterSpacing: 0.2 },
  // Web: <div className="flex justify-between items-center pt-2">
  foodFooter: { flexDirection: 'row', flexWrap:'wrap', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  foodPrice:  { fontSize: 13, fontWeight: '700', color: Colors.neutralBlack, lineHeight: 16, letterSpacing: 0.1 },
  // Web: bg-[#EDEEF2] rounded-[6px] p-0.5
  qtyStepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.neutralGrayLightest, borderRadius: 6, paddingHorizontal: 2, paddingVertical: 2 },
  qtyStepBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  qtyStepText:{ paddingHorizontal: 6, fontSize: 12, fontWeight: '700', color: Colors.neutralBlack },
  // Web's plus icon button (web has a custom SVG; we use the lucide Plus)
  foodPlusBtn:{ padding: 4 },
  // Weekly plan
  dayTab:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.neutralGrayLight, backgroundColor: Colors.neutralWhite, position: 'relative' },
  dayTabActive:{ backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  dayTabText:  { fontSize: 13, fontWeight: '600', color: Colors.neutralBlack },
  dayTabTextActive:{ color: Colors.primary },
  dayBadge:   { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center' },
  dayBadgeText:{ color: Colors.neutralWhite, fontSize: 9, fontWeight: '700' },
  weekItem:   { width: (W - 60) / 2, borderRadius: 12, borderWidth: 1, borderColor: Colors.neutralGrayLightest, backgroundColor: Colors.neutralWhite, overflow: 'hidden', position: 'relative' },
  weekItemActive:{ borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  weekItemImg:{ width: '100%', height: 100 },
  weekItemName:{ fontSize: 12, fontWeight: '600', color: Colors.neutralBlack, padding: 8, lineHeight: 16 },
  weekItemPrice:{ fontSize: 12, fontWeight: '700', color: Colors.primary, paddingHorizontal: 8, paddingBottom: 8 },
  checkCircle:{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  contBtn:    { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  contBtnText:{ color: Colors.neutralWhite, fontSize: 14, fontWeight: '700' },
});

// ── Time slot sidebar styles (mirror of the Vending Locator sidebar) ──────────
const ts = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  panelWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: Math.min(W, 522),
  },
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
  // Web mobile: py-6 px-[15px]
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
    lineHeight: 24,
    fontWeight: '600',
    color: '#111827',
  },
  closeBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  // Slot card — web: my-3 py-[10px] px-4 rounded-[8px]
  // Active: bg-[#EAF5FF] border-[#054A86]; Inactive: border-[#EDEEF2]
  slot: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    backgroundColor: Colors.neutralWhite,
    marginBottom: 12,
  },
  slotActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  slotText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  slotTextActive: {
    color: Colors.primary,
  },
  // Sticky footer — Confirm + Close
  footer: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.neutralWhite,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: Colors.neutralWhite,
    fontWeight: '500',
    fontSize: 15,
  },
  btnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  btnOutline: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    color: Colors.primary,
    fontWeight: '500',
    fontSize: 15,
  },
});

// ── Weekly plan picker styles (port of web PlanWeekly mobile UI) ──────────────
const wp = StyleSheet.create({
  // h2 text-[16px] leading-[24px] font-[700] tracking-[0.1px]
  title: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 12 },

  // FEATURES row — two pills, half-width each
  featureRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  featureBtn: {
    flex: 1,
    minWidth: 0,                              // let flex shrink past content
    height: 44,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.neutralGrayLight,    // #C7C8D2
    backgroundColor: Colors.neutralWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,    // #EAF5FF
  },
  featureBtnText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: Colors.neutralBlack,
    textAlign: 'center',
  },
  featureBtnTextActive: {
    color: Colors.primary,
  },

  // Day dropdown + Saved Plans button row
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 12 },
  // h-[30px] border-2 border-[#054A86] text-[#054A86] bg-[#EAF5FF] rounded-[8px]
  dayDropdown: {
    flex: 1,
    maxWidth: 200,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayDropdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  // h-[30px] gap-2 bg-white border border-[#054A86] rounded-[8px]
  savedBtn: {
    flex: 1,
    maxWidth: 140,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.neutralWhite,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  savedBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.neutralGrayDark,
  },

  // Status block — Selected for X / Total: N Meals
  statusBlock: { gap: 6, marginBottom: 12 },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: Colors.neutralGrayDark,
  },
  statusTotalText: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.neutralGrayDark,
  },
  statusTotalBold: {
    fontWeight: '700',
  },

  // Pickup time row
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  pickupLabel: { fontSize: 13, fontWeight: '600', color: Colors.neutralGrayDark },
  pickupDropdown: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickupDropdownText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 6,
  },

  // Modal picker (day, time)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  modalItemText: {
    fontSize: 15,
    color: Colors.neutralBlack,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalItemTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Inline action buttons at the bottom of the picker (web mobile pattern):
  //   Reset  — outline (visible only when current day has items)
  //   Confirm and review — primary (disabled when totalMealsInPlan === 0)
  actionsCol: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
  },
  resetBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.neutralGrayDark,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    color: Colors.neutralGrayDark,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#F7F7F9',
  },
  confirmBtnText: {
    color: Colors.neutralWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtnTextDisabled: {
    color: '#C7C8D2',
  },
});

// ── Floating CTA bar (web "Sticky Footer Mobile") ─────────────────────────────
const fab = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 40,
  },
  // Web: bg-white p-4 rounded-[20px] border + shadow-[0_-10px_40px_rgba(0,0,0,0.15)]
  bar: {
    backgroundColor: Colors.neutralWhite,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 4,
  },
  // Web: text-[11px] text-gray-400 font-bold uppercase tracking-wider
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  // Web: text-[18px] font-bold text-[#054A86]
  totalText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  // Web: text-[#545563] text-[14px] font-bold underline decoration-2
  resetText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutralGrayDark,
    textDecorationLine: 'underline',
  },
  // Web active: bg-[#054A86] py-5 rounded-[12px] text-[16px] font-bold
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmBtnText: {
    color: Colors.neutralWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  // Web disabled: bg-[#F7F7F9] text-[#C7C8D2]
  confirmBtnDisabled: {
    backgroundColor: '#F7F7F9',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnTextDisabled: {
    color: '#C7C8D2',
  },
});

// ── Item-detail sidebar styles — port of web Menu.tsx item sheet ──────────────
const id = StyleSheet.create({
  // Header — flex items-center justify-between pb-[40px]
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,                    // web text-[28px], slimmed for phones
    lineHeight: 32,                  // web leading-[36px]
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  // Image — h-60 (240px) on web mobile, rounded-[16px]
  image: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    marginTop: 16,
    backgroundColor: Colors.neutralGrayLightest,
  },
  // Tap-to-preview hint pill anchored to the bottom-right of the detail
  // image. Mirrors the web hover overlay "Full preview" badge.
  previewHint: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  previewHintText: {
    color: Colors.neutralWhite,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  body: {
    paddingTop: 20,
    paddingBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',                // web text-gray-600
    marginBottom: 16,
  },
  // Price — text-[24px] leading-[32px] font-[700]
  price: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: Colors.neutralBlack,
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  offerBlock: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
  },
  offerText: {
    fontSize: 14,
    color: Colors.neutralBlack,
  },
  termsLink: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    color: '#056AC1',
    textDecorationLine: 'underline',
  },
  // Footer — flex gap-3, Close outline + + Add primary
  footer: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.neutralWhite,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  btnOutline: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    color: Colors.primary,
    fontWeight: '500',
    fontSize: 15,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: Colors.neutralWhite,
    fontWeight: '500',
    fontSize: 15,
  },
});
