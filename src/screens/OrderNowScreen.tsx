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
import { Check, Minus, Plus, X } from 'lucide-react-native';
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

// ── Menu item card (Order Now / Smart Grab) ────────────────────────────────────
const FoodCard = ({ item, qty, onAdd, onRemove, onPress, isSoldOut, isLocked }: any) => (
  <TouchableOpacity
    style={[s.foodCard, (isSoldOut || isLocked) && { opacity: 0.6 }]}
    onPress={onPress}
    disabled={isLocked}
    activeOpacity={0.85}>
    <View style={s.foodImgWrap}>
      <Image source={{ uri: item.imgSrc || item.image_url }} style={s.foodImg} contentFit="cover" placeholder={{ color: Colors.neutralGrayLightest }} />
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
    <Text style={s.foodName} numberOfLines={2}>{item.heading || item.name}</Text>
    <Text style={s.foodDesc} numberOfLines={1}>{item.description}</Text>
    <Text style={s.foodPrice}>{item.price}</Text>
    {qty > 0 ? (
      <View style={s.qtyRow}>
        <TouchableOpacity style={s.qtyBtn} onPress={onRemove}><Minus size={12} color={Colors.neutralBlack} /></TouchableOpacity>
        <Text style={s.qtyText}>{qty}</Text>
        <TouchableOpacity style={s.qtyBtn} onPress={onAdd}><Plus size={12} color={Colors.neutralBlack} /></TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity style={s.addBtn} onPress={onAdd} disabled={isSoldOut || isLocked}>
        <Text style={s.addBtnText}>+ Add</Text>
      </TouchableOpacity>
    )}
  </TouchableOpacity>
);

// ── Weekly plan day grid ───────────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const WeeklyPlanPicker = ({ apiMenuData, weekPlan, setWeekPlan, onConfirm }: {
  apiMenuData: any; weekPlan: any; setWeekPlan: (p: any) => void; onConfirm: () => void;
}) => {
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const dayItems = apiMenuData?.week_menu?.[selectedDay]?.items || [];
  const selectedDayItems = weekPlan[selectedDay] || [];
  const totalMeals = DAYS.reduce((a, d) => a + (weekPlan[d]?.length || 0), 0);

  const toggleItem = (item: any) => {
    const curr = weekPlan[selectedDay] || [];
    const idx  = curr.findIndex((i: any) => i.id === item.id);
    if (idx >= 0) {
      setWeekPlan({ ...weekPlan, [selectedDay]: curr.filter((_: any, i: number) => i !== idx) });
    } else {
      setWeekPlan({ ...weekPlan, [selectedDay]: [...curr, { ...item, heading: item.name, imgSrc: item.image_url, price: `AED ${parseFloat(item.price).toFixed(2)}`, quantity: 1 }] });
    }
  };

  return (
    <View>
      {/* Day tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {DAYS.map(day => (
          <TouchableOpacity
            key={day}
            style={[s.dayTab, selectedDay === day && s.dayTabActive]}
            onPress={() => setSelectedDay(day)}>
            <Text style={[s.dayTabText, selectedDay === day && s.dayTabTextActive]}>{day}</Text>
            {(weekPlan[day]?.length || 0) > 0 && (
              <View style={s.dayBadge}>
                <Text style={s.dayBadgeText}>{weekPlan[day].length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items for selected day */}
      {dayItems.length === 0 ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: Colors.neutralGray }}>No menu items for {selectedDay}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {dayItems.map((item: any) => {
            const sel = selectedDayItems.some((s: any) => s.id === item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[s.weekItem, sel && s.weekItemActive]}
                onPress={() => toggleItem(item)}>
                <Image source={{ uri: item.image_url }} style={s.weekItemImg} contentFit="cover" />
                <Text style={[s.weekItemName, sel && { color: Colors.primary }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={s.weekItemPrice}>AED {parseFloat(item.price).toFixed(2)}</Text>
                {sel && <View style={s.checkCircle}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: Colors.neutralGrayDark }}>{totalMeals} meals selected</Text>
        <TouchableOpacity style={[s.contBtn, { flex: 0, paddingHorizontal: 24 }]} onPress={onConfirm} disabled={totalMeals === 0}>
          <Text style={s.contBtnText}>Confirm Week</Text>
        </TouchableOpacity>
      </View>
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
          setApiMonthlyMenu(res.data);
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

  // Order Now items enriched with machine availability
  const { availableItems, otherItems } = useMemo(() => {
    if (machineGoods === null) return { availableItems: [], otherItems: apiOrderNowMenu };
    if (machineGoods.length === 0) return { availableItems: [], otherItems: apiOrderNowMenu };
    const available: any[] = []; const others: any[] = [];
    apiOrderNowMenu.forEach(item => {
      const normItem = normalizeName(item.heading);
      const match = machineGoods.find(g => normalizeName(g.goodsName || '') === normItem);
      if (match && (match.presentNumber > 0 || match.presentNumber === undefined)) {
        available.push({ ...item, vendingGoodUuid: match.uuid });
      } else {
        others.push(item);
      }
    });
    return { availableItems: available, otherItems: others };
  }, [apiOrderNowMenu, machineGoods]);

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
      menu_item_id:     item.id,
      quantity:         item.quantity || 1,
      day_of_week:      dayOfWeek,
      week_number:      weekNum,
      vending_good_uuid:item.vendingGoodUuid || null,
      pickup_slot_id:   weekNum && dayOfWeek ? (dayPickupSlots?.[`${weekNum}-${dayOfWeek}`] || null) : null,
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

    setLoading(true);
    try {
      const token = await getAuthToken();
      if (token) {
        await axios.post(`${BASE_URL}/api/vending/cart/`, payload, { headers: { Authorization: `Token ${token}` } });
      } else {
        await setGuestCart(payload);
        dispatch(syncLocalCart(payload.items || []));
      }

      // If last step → go to cart
      if (isLast) {
        navigation.navigate('Cart');
        return;
      }

      setMaxCompleted(activeStep);
      setActiveStep(activeStep + 1);
    } catch (err) {
      Alert.alert('Error', 'Failed to save cart. Please try again.');
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
      <Header />

      {/* Page title */}
      <View style={main.titleArea}>
        <BreadCrumb />
        <Text style={main.pageTitle}>Vending Pickup</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }} showsVerticalScrollIndicator={false}>

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

              {/* Time slot picker */}
              {time ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.primary }}>Selected: {time}</Text>
                  <TouchableOpacity onPress={() => setShowTimeModal(true)}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.primaryBlue, textDecorationLine: 'underline' }}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.primaryBtn} onPress={() => setShowTimeModal(true)}>
                  <Text style={s.primaryBtnText}>Select Timeframe</Text>
                </TouchableOpacity>
              )}

              {time && (
                <TouchableOpacity
                  style={[s.primaryBtn, !time && s.primaryBtnDisabled]}
                  onPress={() => { setMaxCompleted(3); setActiveStep(4); }}
                  disabled={!time}>
                  <Text style={s.primaryBtnText}>Confirm</Text>
                </TouchableOpacity>
              )}
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
                {menuLoading ? <Shimmer /> : (
                  <>
                    {availableItems.length > 0 && (
                      <>
                        <Text style={s.subHeader}>Available Now ({availableItems.length})</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                          {availableItems.map((item: any) => {
                            const qty = orderNowMenu.find(i => i.id === item.id)?.quantity || 0;
                            return (
                              <FoodCard
                                key={item.id} item={item} qty={qty}
                                onAdd={() => setOrderNowMenu(prev => {
                                  const idx = prev.findIndex(i => i.id === item.id);
                                  return idx >= 0 ? prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...item, quantity: 1 }];
                                })}
                                onRemove={() => setOrderNowMenu(prev => {
                                  const idx = prev.findIndex(i => i.id === item.id);
                                  if (idx < 0) return prev;
                                  const newQ = prev[idx].quantity - 1;
                                  return newQ <= 0 ? prev.filter((_, j) => j !== idx) : prev.map((i, j) => j === idx ? { ...i, quantity: newQ } : i);
                                })}
                                onPress={() => setSelectedItem(item)}
                              />
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
                              <FoodCard
                                key={item.id} item={item} qty={qty}
                                onAdd={() => setOrderNowMenu(prev => {
                                  const idx = prev.findIndex(i => i.id === item.id);
                                  return idx >= 0 ? prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...item, quantity: 1 }];
                                })}
                                onRemove={() => setOrderNowMenu(prev => {
                                  const idx = prev.findIndex(i => i.id === item.id);
                                  if (idx < 0) return prev;
                                  const newQ = prev[idx].quantity - 1;
                                  return newQ <= 0 ? prev.filter((_, j) => j !== idx) : prev.map((i, j) => j === idx ? { ...i, quantity: newQ } : i);
                                })}
                                onPress={() => setSelectedItem(item)}
                              />
                            );
                          })}
                        </View>
                      </>
                    )}
                    {orderNowMenu.length > 0 && (
                      <TouchableOpacity style={[s.primaryBtn, { marginTop: 16 }]} onPress={handleConfirmStep} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Confirm ({orderNowMenu.reduce((a, i) => a + i.quantity, 0)} meals) → Go to Cart</Text>}
                      </TouchableOpacity>
                    )}
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
                          <FoodCard
                            key={item.id} item={item} qty={qty}
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
                        );
                      })}
                    </View>
                    {smartGrabMenu.length > 0 && (
                      <TouchableOpacity style={[s.primaryBtn, { marginTop: 16 }]} onPress={handleConfirmStep} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Confirm ({smartGrabMenu.reduce((a, i) => a + i.quantity, 0)} meals) → Go to Cart</Text>}
                      </TouchableOpacity>
                    )}
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
                    onConfirm={handleConfirmStep}
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
                    <Text style={s.stepTitle}>Plan Week {wk} Menu</Text>
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
                      apiMenuData={{ week_menu: apiMonthlyMenu?.month_menu?.[`week_${wk}`] ? Object.fromEntries(DAYS.map(d => [d, { items: apiMonthlyMenu.month_menu[`week_${wk}`]?.[d] || [] }])) : null }}
                      weekPlan={wkMenu}
                      setWeekPlan={setWkMenu}
                      onConfirm={handleConfirmStep}
                    />
                  )}
                </View>
              )}
            </StepCard>
          );
        })}

      </ScrollView>

      {/* Time slot modal */}
      <Modal visible={showTimeModal} transparent animationType="slide" onRequestClose={() => setShowTimeModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowTimeModal(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: Colors.neutralWhite, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '60%' }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 16 }}>Select Timeframe</Text>
                <ScrollView>
                  {(timeSlots.length > 0 ? timeSlots : [
                    { id: 1, label: '8:00 AM – 10:00 AM' },
                    { id: 2, label: '10:00 AM – 12:00 PM' },
                    { id: 3, label: '12:00 PM – 2:00 PM' },
                    { id: 4, label: '2:00 PM – 4:00 PM' },
                  ]).map((slot: any) => (
                    <TouchableOpacity
                      key={slot.id}
                      style={[{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1 },
                        time === slot.label ? { backgroundColor: Colors.primaryLight, borderColor: Colors.primary } : { borderColor: Colors.neutralGrayLight, backgroundColor: Colors.neutralWhite }]}
                      onPress={() => { setTime(slot.label); setShowTimeModal(false); }}>
                      <Text style={[{ fontSize: 16, fontWeight: '500' }, time === slot.label ? { color: Colors.primary } : { color: Colors.neutralBlack }]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Item detail modal */}
      <Modal visible={!!selectedItem} transparent animationType="slide" onRequestClose={() => setSelectedItem(null)}>
        <TouchableWithoutFeedback onPress={() => setSelectedItem(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: Colors.neutralWhite, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                <Image source={{ uri: selectedItem?.imgSrc }} style={{ width: '100%', height: 220 }} contentFit="cover" />
                <View style={{ padding: 20 }}>
                  <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 8 }}>{selectedItem?.heading}</Text>
                  <Text style={{ fontSize: 14, color: Colors.neutralGrayDark, lineHeight: 20, marginBottom: 12 }}>{selectedItem?.description}</Text>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.primary, marginBottom: 20 }}>{selectedItem?.price}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity style={[s.primaryBtn, { flex: 1, backgroundColor: Colors.neutralWhite, borderWidth: 1, borderColor: Colors.primary }]} onPress={() => setSelectedItem(null)}>
                      <Text style={[s.primaryBtnText, { color: Colors.primary }]}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.primaryBtn, { flex: 1 }]} onPress={() => {
                      setOrderNowMenu(prev => {
                        const idx = prev.findIndex(i => i.id === selectedItem.id);
                        return idx >= 0 ? prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i) : [...prev, { ...selectedItem, quantity: 1 }];
                      });
                      setSelectedItem(null);
                    }}>
                      <Text style={s.primaryBtnText}>Add to Cart</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
  // Food card
  foodCard:   { width: (W - 56) / 2, backgroundColor: Colors.neutralWhite, borderRadius: 12, borderWidth: 1, borderColor: Colors.neutralGrayLightest, overflow: 'hidden', marginBottom: 4 },
  foodImgWrap:{ width: '100%', height: 130, position: 'relative' },
  foodImg:    { width: '100%', height: '100%' },
  foodOverlay:{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  foodBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  foodBadgeText:{ color: Colors.neutralWhite, fontSize: 10, fontWeight: '700' },
  foodName:   { fontSize: 13, fontWeight: '700', color: Colors.neutralBlack, paddingHorizontal: 10, paddingTop: 8, lineHeight: 18 },
  foodDesc:   { fontSize: 11, color: Colors.neutralGray, paddingHorizontal: 10, marginTop: 2, lineHeight: 16 },
  foodPrice:  { fontSize: 13, fontWeight: '700', color: Colors.neutralBlack, paddingHorizontal: 10, marginTop: 4 },
  qtyRow:     { flexDirection: 'row', alignItems: 'center', margin: 10, backgroundColor: Colors.neutralGrayLightest, borderRadius: 8, padding: 4 },
  qtyBtn:     { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  qtyText:    { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', color: Colors.neutralBlack },
  addBtn:     { margin: 10, backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  addBtnText: { color: Colors.neutralWhite, fontSize: 12, fontWeight: '700' },
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
