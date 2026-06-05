/**
 * CartScreen — faithful translation of web pages/CartPage.tsx
 *
 * Web structure (preserved exactly):
 *   Header
 *   BreadCrumb + h2 {getMainTitle()} | [Clear Cart] (Trash2 + "Clear Cart" text)
 *   ─────
 *   LEFT col (lg:col-span-2):
 *     [Guest banner if no token] — bg-[#EAF5FF] Info icon + "Guest Checkout" + Google sign-in btn
 *     [Sweets minimum order warning] — bg-orange-50
 *     [Stock alerts] — bg-yellow-50
 *     Groups:
 *       For "Dosta Sweets": marquee banner bg-[#054A86] + delivery details card
 *       OrderList: title + "{N} meals" + CartItem rows
 *         CartItem: img 72x72 md-rounded | name font-[700] | notes | pickup | heating toggle | qty stepper | price | delete
 *       [+ Add More Meals] link
 *     Empty cart state
 *   RIGHT col (lg:col-span-1):
 *     OrderSummary: "Order Summary" text-[28px] | coupon input w/ tick | subtotal/vat/delivery/discount rows | total | [Proceed to checkout]
 *   ─────
 *   AlertDialog: "Confirm Payment" → [Cancel] [Confirm & Pay]
 *   AlertDialog: "Are you absolutely sure?" clear cart
 *   ─────
 *   Post-payment panel (confirmedOrder):
 *     🎉 QR code 180×180 | "Pickup Code" large | [View My Orders]
 *     OR ⚠️ retry panel
 *   ─────
 *   MobileFooterNav, Footer, AuthPromptModal
 *
 * All logic preserved from web CartPage.tsx exactly.
 */

import DeleteIcon   from '@/assets/images/icons/delete.svg';
import RoundTickIcon from '@/assets/images/icons/round_tick.svg';
import VisaIcon      from '@/assets/images/icons/visa.svg';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image as RNImage,
  Linking,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import Toast from 'react-native-toast-message';
import { Trash2, Info, Minus, Plus, Plus as PlusIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import BreadCrumb from '@/components/ui/BreadCrumb';
import AuthPromptModal from '@/components/common/AuthPromptModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import OrderTimeRestrictionModal from '@/components/common/OrderTimeRestrictionModal';
import { syncLocalCart } from '@/store/slices/cartSlice';
import {
  getAuthToken,
  getGuestCart,
  setGuestCart,
  removeGuestCart,
  getSweetsDeliveryInfo,
  getBeitNahlaCart,
  removeBeitNahlaCart,
  getBeitNahlaDeliveryInfo,
  removeBeitNahlaDeliveryInfo,
} from '@/utils/storage';
import { BASE_URL } from '@/services/api';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types (identical to web CartPage.tsx) ─────────────────────────────────
export interface CartItemType {
  id:             number;
  menuItemId:     number;
  name:           string;
  notes:          string;
  pickupLocation: string;
  imageUrl:       string;
  quantity:       number;
  price:          number;
  dayOfWeek:      string | null;
  weekNumber:     number | null;
  vendingGoodUuid:string | null;
  planType:       string;
  planSubtype:    string;
  variationId?:   number | null;
  heating?:       string;
  heatingChoice?: 'yes' | 'no';
}

interface CartAPI {
  id:           number;
  location:     { id: number; name: string; info: string; serial_number?: string } | null;
  plan_type:    string;
  plan_subtype: string;
  pickup_type:  string | null;
  pickup_date:  string | null;
  pickup_slot:  { id: number; label: string } | null;
  total_price:  string;
  city?:        string;
  delivery_charge?: string;
  items:        any[];
}

const normalizeName = (name: string) => {
  if (!name) return '';
  return name.replace(/&/g, 'and').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
};

// ─── CartItem Row (translation of web CartItem.tsx) ────────────────────────
const CartItemRow = ({
  item,
  onQtyChange,
  onDelete,
  onHeatingChange,
}: {
  item: CartItemType;
  onQtyChange: (id: number, delta: number) => void;
  onDelete: (id: number) => void;
  onHeatingChange: (id: number, choice: 'yes' | 'no') => void;
}) => (
  <View style={styles.cartItemRow}>
    {/* Image — md:w-[72px] md:h-[72px] rounded-xl */}
    <Image
      source={{ uri: item.imageUrl || 'https://placehold.co/72x72' }}
      style={styles.cartItemImg}
      contentFit="cover"
    />

    <View style={styles.cartItemBody}>
      {/* Name — text-[16px] font-[700] */}
      <Text style={styles.cartItemName}>{item.name}</Text>

      {/* Notes */}
      {item.notes && item.notes !== 'Other notes or copy here' && (
        <Text style={styles.cartItemNote}>{item.notes}</Text>
      )}

      {/* Pickup location (not SWEETS) */}
      {item.pickupLocation &&
        item.pickupLocation !== 'Unknown Location' &&
        item.planType !== 'SWEETS' && (
          <Text style={styles.cartItemLocation}>
            pick up at: <Text style={styles.cartItemLocationBold}>{item.pickupLocation}</Text>
          </Text>
        )}

      {/* Heating toggle — exact from web */}
      {item.heating === 'yes' && (
        <View style={styles.heatingRow}>
          <Text style={styles.heatingLabel}>Add Heating?</Text>
          <View style={styles.heatingToggle}>
            <TouchableOpacity
              style={[styles.heatingBtn, item.heatingChoice === 'yes' && styles.heatingBtnActive]}
              onPress={() => onHeatingChange(item.id, 'yes')}>
              <Text style={[styles.heatingBtnText, item.heatingChoice === 'yes' && styles.heatingBtnTextActive]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heatingBtn, item.heatingChoice !== 'yes' && styles.heatingBtnActive]}
              onPress={() => onHeatingChange(item.id, 'no')}>
              <Text style={[styles.heatingBtnText, item.heatingChoice !== 'yes' && styles.heatingBtnTextActive]}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.cartItemFooter}>
        {/* Qty stepper — bg-[#EDEEF2] p-[3px] rounded-[4px] */}
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => onQtyChange(item.id, -1)}>
            <Minus size={10} color={Colors.neutralBlack} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => onQtyChange(item.id, 1)}>
            <Plus size={10} color={Colors.neutralBlack} />
          </TouchableOpacity>
        </View>

        {/* Price — text-lg font-[700] */}
        <Text style={styles.cartItemPrice}>AED{item.price.toFixed(2)}</Text>

        {/* Delete — /images/icons/delete.svg */}
        <TouchableOpacity onPress={() => onDelete(item.id)}>
          <DeleteIcon width={24} height={24} />
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

// ─── OrderList (translation of web OrderList.tsx) ──────────────────────────
const OrderList = ({
  title = 'Order Now',
  items = [],
  groupedItems,
  onQtyChange,
  onDelete,
  onHeatingChange,
}: {
  title?: string;
  items?: CartItemType[];
  groupedItems?: { title: string; items: CartItemType[] }[];
  onQtyChange: (id: number, delta: number) => void;
  onDelete: (id: number) => void;
  onHeatingChange: (id: number, choice: 'yes' | 'no') => void;
}) => {
  const navigation = useNavigation<any>();
  const totalItems = groupedItems
    ? groupedItems.reduce((acc, g) => acc + g.items.length, 0)
    : items.length;

  return (
    <View style={styles.orderListCard}>
      {/* Header: "Order Now  3 meals" */}
      <View style={styles.orderListHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={styles.orderListTitle}>{title}</Text>
          <Text style={styles.orderListCount}>{totalItems} meals</Text>
        </View>
      </View>

      <View style={styles.orderListItems}>
        {groupedItems
          ? groupedItems.map((group, gi) => (
              <View key={gi} style={{ marginBottom: 24 }}>
                <Text style={styles.groupTitle}>{group.title}</Text>
                {group.items.map((item, index) => (
                  <View key={item.id}>
                    <CartItemRow
                      item={item}
                      onQtyChange={onQtyChange}
                      onDelete={onDelete}
                      onHeatingChange={onHeatingChange}
                    />
                    {index < group.items.length - 1 && <View style={styles.itemDivider} />}
                  </View>
                ))}
              </View>
            ))
          : items.map((item, index) => (
              <View key={item.id}>
                <CartItemRow
                  item={item}
                  onQtyChange={onQtyChange}
                  onDelete={onDelete}
                  onHeatingChange={onHeatingChange}
                />
                {index < items.length - 1 && <View style={styles.itemDivider} />}
              </View>
            ))}
      </View>

      {/* Add More Meals link */}
      <TouchableOpacity
        style={styles.addMoreRow}
        onPress={() =>
          navigation.navigate(title === 'Dosta Sweets' ? 'DostaSweets' : 'OrderNow')
        }>
        <Plus size={20} color={Colors.primary} />
        <Text style={styles.addMoreText}>Add More Meals</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── OrderSummary (translation of web OrderSummary.tsx) ────────────────────
const OrderSummary = ({
  subtotal,
  vat,
  discount,
  deliveryCharge = 0,
  serviceCharge = 0,
  city,
  total,
  coupon = '',
  setCoupon,
  onCheckout,
  loading = false,
  disabled = false,
}: any) => {
  const isCouponApplied = coupon.trim().toUpperCase() === 'DOSTA25';

  return (
    <View style={styles.summaryCard}>
      {/* h2 "Order Summary" text-[28px] font-[700] text-[#2B2B43] */}
      <Text style={styles.summaryTitle}>Order Summary</Text>

      {/* Coupon code */}
      <View style={styles.couponWrap}>
        <Text style={styles.couponLabel}>Coupon code</Text>
        <View style={styles.couponRow}>
          <TextInput
            style={styles.couponInput}
            placeholder="Enter coupon code"
            placeholderTextColor={Colors.neutralGray}
            autoCapitalize="characters"
            value={coupon}
            onChangeText={setCoupon}
          />
          {isCouponApplied && (
            <View style={styles.tickIcon}>
              <RoundTickIcon width={24} height={24} />
            </View>
          )}
        </View>
      </View>

      {/* Price rows */}
      <View style={styles.priceRows}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Subtotal</Text>
          <Text style={styles.priceValue}>AED{subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>VAT</Text>
          <Text style={styles.priceValue}>AED{vat.toFixed(2)}</Text>
        </View>
        {city && (
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: '#4F46E5', fontWeight: '700' }]}>
              Delivery Charge ({city})
            </Text>
            <Text style={[styles.priceValue, { color: '#4F46E5', fontWeight: '700' }]}>
              {city === 'Dubai' ? 'FREE' : `+ AED${deliveryCharge.toFixed(2)}`}
            </Text>
          </View>
        )}
        {/* Beit Nahla / non-Sweets delivery: only when actually charged */}
        {!city && deliveryCharge > 0 && (
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: Colors.primary, fontWeight: '700' }]}>
              Delivery Charge
            </Text>
            <Text style={[styles.priceValue, { color: Colors.primary, fontWeight: '700' }]}>
              + AED{deliveryCharge.toFixed(2)}
            </Text>
          </View>
        )}
        {serviceCharge > 0 && (
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: Colors.primary, fontWeight: '700' }]}>
              Service Charge
            </Text>
            <Text style={[styles.priceValue, { color: Colors.primary, fontWeight: '700' }]}>
              + AED{serviceCharge.toFixed(2)}
            </Text>
          </View>
        )}
        {isCouponApplied && (
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: Colors.primaryBlue }]}>Discount (coupon)</Text>
            <Text style={[styles.priceValue, { color: Colors.primaryBlue }]}>
              - AED{discount.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      {/* Total — flex justify-between */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          Total <Text style={{ fontWeight: '400' }}>(VAT incl.)</Text>
        </Text>
        <Text style={styles.totalValue}>AED{total.toFixed(2)}</Text>
      </View>

      {/* Checkout button */}
      <TouchableOpacity
        style={[styles.checkoutBtn, (loading || disabled) && styles.checkoutBtnDisabled]}
        onPress={onCheckout}
        disabled={loading || disabled || !onCheckout}>
        {loading ? (
          <ActivityIndicator color={Colors.neutralWhite} />
        ) : (
          <Text style={styles.checkoutBtnText}>Proceed to checkout</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ─── Screen ────────────────────────────────────────────────────────────────
export default function CartScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const dispatch   = useDispatch();

  const [cartData,          setCartData]          = useState<CartAPI | null>(null);
  const [items,             setItems]              = useState<CartItemType[]>([]);
  const [coupon,            setCoupon]             = useState('');
  const [loading,           setLoading]            = useState(true);
  const [isCheckingOut,     setIsCheckingOut]      = useState(false);
  const [imageMap,          setImageMap]           = useState<Record<string, string>>({});
  const [stockMap,          setStockMap]           = useState<Record<string, number>>({});
  const [stockLoaded,       setStockLoaded]        = useState(false);
  const [heatingChoices,    setHeatingChoices]     = useState<Record<number, 'yes' | 'no'>>({});
  const [sweetsDeliveryInfo,setSweetsDeliveryInfo] = useState<any>(null);
  const [beitNahlaDeliveryInfo, setBeitNahlaDeliveryInfo] = useState<any>(null);
  const [confirmedOrder,    setConfirmedOrder]     = useState<any>(null);
  const [retrying,          setRetrying]           = useState(false);
  const [retryError,        setRetryError]         = useState<string | null>(null);
  const [showPaymentDialog, setShowPaymentDialog]  = useState(false);
  const [showClearDialog,   setShowClearDialog]    = useState(false);
  const [showAuthModal,     setShowAuthModal]      = useState(false);
  // Mirrors web `showOrderTimeModal` — gates checkout for WEEKLY / MONTHLY /
  // SWEETS carts to UAE 07:00–18:00 (see processCheckout in web CartPage).
  const [showOrderTimeModal, setShowOrderTimeModal] = useState(false);
  const [stockAlerts,       setStockAlerts]        = useState<string[]>([]);

  const isPaymentReturn = useRef(
    route.params?.payment_success === 'true' ||
    route.params?.payment_success === true,
  );

  useEffect(() => {
    getSweetsDeliveryInfo().then((info) => { if (info) setSweetsDeliveryInfo(info); });
    getBeitNahlaDeliveryInfo().then((info) => { if (info) setBeitNahlaDeliveryInfo(info); });
  }, []);

  // mapCartToUI — identical to web
  const mapCartToUI = useCallback(
    (cart: CartAPI, currentImageMap: Record<string, string> = imageMap) => {
      const locationName = cart.location?.name || 'Unknown Location';
      const mapped: CartItemType[] = (cart.items || [])
        .filter((apiItem) => apiItem && apiItem.menu_item)
        .map((apiItem) => {
          let notes = 'Enjoy your meal!';
          if (
            (apiItem.plan_subtype === 'WEEKLY' || apiItem.plan_subtype === 'MONTHLY') &&
            apiItem.day_of_week
          ) notes = `Meal for ${apiItem.day_of_week}`;
          return {
            id:             apiItem.id,
            menuItemId:     apiItem.menu_item?.id || 0,
            name:           apiItem.menu_item?.name || 'Unknown Item',
            notes,
            pickupLocation: locationName,
            imageUrl:
              currentImageMap[apiItem.menu_item?.name || ''] ||
              apiItem.menu_item?.image_url || '',
            quantity:       apiItem.quantity,
            price:          parseFloat(apiItem.menu_item?.price || '0'),
            dayOfWeek:      apiItem.day_of_week,
            weekNumber:     apiItem.week_number,
            vendingGoodUuid:apiItem.vending_good_uuid,
            planType:       apiItem.plan_type || cart.plan_type,
            planSubtype:    apiItem.plan_subtype || cart.plan_subtype,
            variationId:    apiItem.variation_id || null,
            heating:        apiItem.menu_item?.heating,
            heatingChoice:  apiItem.heating_requested
              ? 'yes'
              : heatingChoices[apiItem.id] || 'no',
          };
        });
      setItems(mapped);
      dispatch(syncLocalCart(mapped));
      if (cart.city && cart.plan_type === 'SWEETS') {
        setSweetsDeliveryInfo((prev: any) => ({
          address: prev?.address || '',
          phone:   prev?.phone   || '',
          city:    cart.city || prev?.city,
        }));
      }
    },
    [imageMap, heatingChoices, dispatch],
  );

  // Fetch cart on mount
  useEffect(() => {
    if (isPaymentReturn.current) return;
    const fetchMenuAndCart = async () => {
      setLoading(true);
      try {
        const token = await getAuthToken();
        const newImageMap: Record<string, string> = {};
        if (token) {
          try {
            const menuRes = await axios.get(`${BASE_URL}/api/vending/menu/ORDER_NOW/`, {
              headers: { Authorization: `Token ${token}` },
            });
            menuRes.data.menus?.forEach((menu: any) => {
              menu.items?.forEach((it: any) => {
                if (it.image_url && !newImageMap[it.name]) newImageMap[it.name] = it.image_url;
              });
            });
          } catch {}
        }
        setImageMap(newImageMap);
        let cartResponseData = null;
        if (token) {
          const cartRes = await axios.get(`${BASE_URL}/api/vending/cart/`, {
            headers: { Authorization: `Token ${token}` },
          });
          cartResponseData = cartRes.data;
        } else {
          cartResponseData = await getGuestCart();
        }

        // Merge Beit Nahla items (vending backend can't store them, so they
        // live in a dedicated key — identical to web cartSlice.ts). Deduped by
        // plan_type + id so a guest cart that already holds them isn't doubled.
        const bnCart = await getBeitNahlaCart();
        const beitNahlaItems: any[] = Array.isArray(bnCart?.items) ? bnCart.items : [];
        if (beitNahlaItems.length > 0) {
          const base = cartResponseData || { items: [], total_price: '0.00' };
          const seen = new Set(
            (base.items || []).map(
              (i: any) => `${i.plan_type || ''}:${i.menu_item?.id || i.id}`,
            ),
          );
          for (const bn of beitNahlaItems) {
            const k = `${bn.plan_type || 'BEIT_NAHLA'}:${bn.menu_item?.id || bn.id}`;
            if (!seen.has(k)) {
              base.items = [...(base.items || []), bn];
              seen.add(k);
            }
          }
          cartResponseData = base;
        }

        if (cartResponseData) {
          setCartData(cartResponseData);
          mapCartToUI(cartResponseData, newImageMap);
        }
      } catch { setItems([]); }
      finally { setLoading(false); }
    };
    fetchMenuAndCart();
  }, []);

  // Payment return handling
  useEffect(() => {
    if (!isPaymentReturn.current) return;
    const verifyPaymentReturn = async () => {
      const { order_id, cart_id } = route.params || {};
      setIsCheckingOut(true);
      try {
        const token = await getAuthToken();
        const verifyUrl = order_id
          ? `${BASE_URL}/api/vending/payment/callback/?order_id=${order_id}`
          : `${BASE_URL}/api/vending/payment/callback/?order_id=CART-${cart_id}`;
        const res = await axios.get(verifyUrl, { headers: { Authorization: `Token ${token}` } });
        if (res.status === 200 || res.status === 201) {
          const cartRes = await axios.get(`${BASE_URL}/api/vending/cart/`, {
            headers: { Authorization: `Token ${token}` },
          });
          const currentCart = cartRes.data;
          if (currentCart?.items) {
            const checkoutItems = currentCart.items.map((it: any) => ({
              menu_item_id:      it.menu_item?.id,
              quantity:          it.quantity,
              day_of_week:       it.day_of_week,
              week_number:       it.week_number,
              vending_good_uuid: it.vending_good_uuid || null,
              heating_requested: it.heating_requested,
              plan_type:         it.plan_type,
              plan_subtype:      it.plan_subtype,
            }));
            // Get sweetsDeliveryInfo for SWEETS orders (identical to web)
            let deliveryAdd = ''; let custPhone = '';
            if (currentCart.plan_type === 'SWEETS') {
              const sdi = await getSweetsDeliveryInfo();
              deliveryAdd = sdi?.address || '';
              custPhone   = sdi?.phone   || '';
            }
            const orderPayload: any = {
              location_id:      currentCart.location?.id,
              plan_type:        currentCart.plan_type,
              plan_subtype:     currentCart.plan_subtype,
              pickup_type:      currentCart.pickup_type,
              pickup_date:      currentCart.pickup_date,
              pickup_slot_id:   currentCart.pickup_slot?.id,
              items:            checkoutItems,
              is_payment_verified: true,
            };
            if (deliveryAdd && custPhone) {
              orderPayload.delivery_address = deliveryAdd;
              orderPayload.customer_phone   = custPhone;
              orderPayload.city             = currentCart.city;
              orderPayload.delivery_charge  = currentCart.delivery_charge;
            }
            const orderRes = await axios.post(
              `${BASE_URL}/api/vending/order/confirm/`,
              orderPayload,
              { headers: { Authorization: `Token ${token}` } },
            );
            const newOrder = orderRes.data.order;
            if (newOrder) {
              await axios.post(`${BASE_URL}/api/vending/cart/`, { clear_all: true }, {
                headers: { Authorization: `Token ${token}` },
              });
              setItems([]);
              setCartData(null);
              dispatch(syncLocalCart([]));
              Toast.show({ type: 'success', text1: 'Payment Successful! Order Confirmed.' });
              setConfirmedOrder(newOrder);
              return;
            }
          }
          navigation.navigate('MyOrders');
        }
      } catch (err) {
        Toast.show({ type: 'error', text1: "Could not verify payment. Check 'My Orders'." });
      } finally { setIsCheckingOut(false); }
    };
    verifyPaymentReturn();
  }, []);

  // Quantity change — identical to web
  const handleQuantityChange = async (id: number, delta: number) => {
    const itemToUpdate = items.find((i) => i.id === id);
    if (!itemToUpdate) return;
    let maxStock = 99;
    if (itemToUpdate.planType === 'ORDER_NOW' || itemToUpdate.planType === 'SMART_GRAB') {
      if (itemToUpdate.vendingGoodUuid && stockMap[itemToUpdate.vendingGoodUuid] !== undefined) {
        maxStock = stockMap[itemToUpdate.vendingGoodUuid];
      } else {
        const normName = normalizeName(itemToUpdate.name);
        if (stockMap[normName] !== undefined) {
          maxStock = stockMap[normName];
        } else if (!stockLoaded) {
          // Stock not yet loaded — block increases (identical to web)
          if (delta > 0) {
            Toast.show({ type: 'info', text1: 'Checking stock availability...' });
            return;
          }
          maxStock = itemToUpdate.quantity;
        } else {
          maxStock = 0; // Stock loaded but item not found → treat as out of stock
        }
      }
    } else if (itemToUpdate.planType === 'START_PLAN') { maxStock = 3; }
    const newQ = Math.min(maxStock, Math.max(1, itemToUpdate.quantity + delta));
    if (newQ === itemToUpdate.quantity) {
      if (itemToUpdate.quantity === maxStock && delta > 0) {
        Toast.show({ type: 'info', text1: `Only ${maxStock} items available.` });
      }
      return;
    }
    const updatedAllItems = items.map((item) =>
      item.id === id ? { ...item, quantity: newQ } : item,
    );
    setItems(updatedAllItems);
    const token = await getAuthToken();
    const samePlanItems = updatedAllItems.filter(
      (i) => i.planType === itemToUpdate.planType && i.planSubtype === itemToUpdate.planSubtype,
    );
    const apiItems = samePlanItems.map((i) => ({
      menu_item_id:      i.menuItemId,
      variation_id:      i.variationId || null,
      quantity:          i.quantity,
      day_of_week:       i.dayOfWeek,
      week_number:       i.weekNumber,
      vending_good_uuid: i.vendingGoodUuid,
      heating_requested: i.heatingChoice === 'yes',
    }));
    if (token) {
      try {
        await axios.post(`${BASE_URL}/api/vending/cart/`, {
          location_id:  cartData?.location?.id,
          plan_type:    itemToUpdate.planType,
          plan_subtype: itemToUpdate.planSubtype,
          items:        apiItems,
        }, { headers: { Authorization: `Token ${token}` } });
      } catch {}
    } else {
      // Guest path — persist the updated quantity to AsyncStorage. Without
      // this, closing the app or navigating away would lose the change since
      // the reducer no longer writes to storage.
      const existing = await getGuestCart();
      await setGuestCart({ ...(existing || {}), items: updatedAllItems });
    }
    dispatch(syncLocalCart(updatedAllItems));
  };

  const handleDeleteItem = async (id: number) => {
    const itemToDelete = items.find((i) => i.id === id);
    if (!itemToDelete) return;
    const updatedAllItems = items.filter((i) => i.id !== id);
    setItems(updatedAllItems);
    dispatch(syncLocalCart(updatedAllItems));
    const token = await getAuthToken();
    const samePlanItems = updatedAllItems.filter(
      (i) => i.planType === itemToDelete.planType && i.planSubtype === itemToDelete.planSubtype,
    );
    const apiItems = samePlanItems.map((i) => ({
      menu_item_id:      i.menuItemId,
      quantity:          i.quantity,
      day_of_week:       i.dayOfWeek,
      week_number:       i.weekNumber,
      vending_good_uuid: i.vendingGoodUuid,
      heating_requested: i.heatingChoice === 'yes',
    }));
    if (token) {
      try {
        await axios.post(`${BASE_URL}/api/vending/cart/`, {
          location_id:  cartData?.location?.id,
          plan_type:    itemToDelete.planType,
          plan_subtype: itemToDelete.planSubtype,
          items:        apiItems,
        }, { headers: { Authorization: `Token ${token}` } });
      } catch {}
    } else {
      // Guest path — mirror the change into AsyncStorage so it survives a
      // restart. If the user just deleted their last item, drop the whole
      // guestCart entry instead of leaving an empty-items shell behind.
      if (updatedAllItems.length === 0) {
        await removeGuestCart();
      } else {
        const existing = await getGuestCart();
        await setGuestCart({ ...(existing || {}), items: updatedAllItems });
      }
    }
  };

  const handleHeatingChange = (id: number, choice: 'yes' | 'no') => {
    setHeatingChoices((prev) => ({ ...prev, [id]: choice }));
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, heatingChoice: choice } : item));
  };

  const handleClearCart = async () => {
    const token = await getAuthToken();
    try {
      if (token) await axios.post(`${BASE_URL}/api/vending/cart/`, { clear_all: true }, { headers: { Authorization: `Token ${token}` } });
      else await removeGuestCart();
      setItems([]);
      dispatch(syncLocalCart([]));
    } catch {}
    setShowClearDialog(false);
  };

  const processCheckout = async () => {
    if (!cartData) return;
    const token = await getAuthToken();
    if (!token) { setShowAuthModal(true); setShowPaymentDialog(false); return; }
    setIsCheckingOut(true);
    try {
      const initPayload: any = { location_id: cartData.location?.id };
      if (cartData.plan_type === 'SWEETS' && sweetsDeliveryInfo) {
        initPayload.delivery_address = sweetsDeliveryInfo.address;
        initPayload.customer_phone   = sweetsDeliveryInfo.phone;
        initPayload.city             = cartData.city;
        initPayload.delivery_charge  = cartData.delivery_charge;
      }
      const payRes = await axios.post(`${BASE_URL}/api/vending/payment/initiate/`, initPayload, {
        headers: { Authorization: `Token ${token}` },
      });
      const redirectUrl = payRes.data.payment_redirect_url;
      if (redirectUrl) {
        setShowPaymentDialog(false);
        await Linking.openURL(redirectUrl);
        return;
      }
      navigation.navigate('MyOrders');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Checkout failed. Please try again.';
      Toast.show({ type: 'error', text1: typeof msg === 'string' ? msg : JSON.stringify(msg) });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleRetryFulfillment = async () => {
    if (!confirmedOrder) return;
    const token = await getAuthToken();
    setRetrying(true); setRetryError(null);
    try {
      const res = await axios.post(`${BASE_URL}/api/vending/order/${confirmedOrder.id}/retry-fulfillment/`, {}, { headers: { Authorization: `Token ${token}` } });
      const orderRes = await axios.get(`${BASE_URL}/api/vending/orders/`, { headers: { Authorization: `Token ${token}` } });
      const fresh = (orderRes.data as any[]).find((o: any) => o.id === confirmedOrder.id);
      setConfirmedOrder(fresh || { ...confirmedOrder, ...res.data });
      if (!fresh?.pickup_code && !res.data.pickup_code)
        setRetryError("Couldn't generate pickup code. Please try again.");
    } catch (err: any) {
      setRetryError(err.response?.data?.error || 'Retry failed. Please try again.');
    } finally { setRetrying(false); }
  };

  // Summary calc — identical to web
  const summary = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const vat      = subtotal * 0.05;
    const discount = coupon.toUpperCase() === 'DOSTA25' ? 25.0 : 0;
    // Treat the cart as Sweets ONLY when actual SWEETS items are present.
    // Reading cartData.plan_type alone mis-flags a Beit Nahla cart as Sweets
    // (its payload carries city "Dubai"), which renders the misleading
    // "Delivery Charge (Dubai) — FREE" line and hides the real Beit Nahla
    // delivery/service charges. Identical guard to web CartPage.tsx.
    const hasSweets = items.some((i) => i.planType === 'SWEETS');
    const isSweets = hasSweets;
    // city only matters for the Sweets delivery scheme
    const city = hasSweets ? cartData?.city || sweetsDeliveryInfo?.city : undefined;
    let effectiveCharge = hasSweets ? parseFloat(cartData?.delivery_charge || '0') : 0;
    if (hasSweets && city && city !== 'Dubai') effectiveCharge = 40;

    // ── Beit Nahla fees ───────────────────────────────────────────────
    // The Beit Nahla flow stored its calculated service + delivery charges
    // under beitNahlaDeliveryInfo. If Beit Nahla items are in the cart, fold
    // them into the totals (identical to web CartPage.tsx).
    const hasBeitNahla = items.some((i) => i.planType === 'BEIT_NAHLA');
    const bnServiceCharge =
      hasBeitNahla && beitNahlaDeliveryInfo?.service_charge
        ? Number(beitNahlaDeliveryInfo.service_charge)
        : 0;
    const bnDeliveryCharge =
      hasBeitNahla && beitNahlaDeliveryInfo?.delivery_charge
        ? Number(beitNahlaDeliveryInfo.delivery_charge)
        : 0;

    const activeDeliveryCharge = items.length > 0 ? effectiveCharge + bnDeliveryCharge : 0;
    const activeServiceCharge  = items.length > 0 ? bnServiceCharge : 0;
    const finalTotal = Math.max(
      0,
      subtotal + vat - discount + activeDeliveryCharge + activeServiceCharge,
    );
    const isMinimumMet = !isSweets || city === 'Dubai' || subtotal >= 100;
    return {
      subtotal,
      vat,
      discount,
      deliveryCharge: activeDeliveryCharge,
      serviceCharge: activeServiceCharge,
      total: finalTotal,
      isMinimumMet,
      isSweets,
      hasBeitNahla,
      city,
    };
  }, [items, coupon, cartData, sweetsDeliveryInfo, beitNahlaDeliveryInfo]);

  const getMainTitle = () => {
    if (!cartData) return 'Order Now';
    if (cartData.plan_type === 'SWEETS') return 'Dosta Sweets';
    if (cartData.plan_type === 'SMART_GRAB') return 'Smart Grab';
    if (cartData.plan_subtype === 'WEEKLY') return 'Weekly Plan';
    if (cartData.plan_subtype === 'MONTHLY') return 'Monthly Plan';
    if (cartData.pickup_type === 'IN_24_HOURS') return 'Pickup in 24';
    return 'Order Now';
  };

  // getGroupedCartItems — identical to web
  const getGroupedCartItems = () => {
    const groups: { title: string; items: CartItemType[]; groupedItems?: any[] }[] = [];
    const orderNowItems = items.filter((i) => i.planType === 'ORDER_NOW' || i.planType === 'SMART_GRAB');
    if (orderNowItems.length > 0) groups.push({ title: 'Order Now', items: orderNowItems });
    const sweetsItems = items.filter((i) => i.planType === 'SWEETS');
    if (sweetsItems.length > 0) groups.push({ title: 'Dosta Sweets', items: sweetsItems });
    const beitNahlaItems = items.filter((i) => i.planType === 'BEIT_NAHLA');
    if (beitNahlaItems.length > 0) groups.push({ title: 'Beit Nahla', items: beitNahlaItems });
    const weeklyItems = items.filter((i) => i.planType === 'START_PLAN' && i.planSubtype === 'WEEKLY');
    if (weeklyItems.length > 0) groups.push({ title: 'Weekly Plan', items: weeklyItems });
    const monthlyItems = items.filter((i) => i.planType === 'START_PLAN' && i.planSubtype === 'MONTHLY');
    if (monthlyItems.length > 0) {
      const weeks = [1, 2, 3, 4];
      const monthlyGroups: any[] = [];
      for (const week of weeks) {
        const weekItems = monthlyItems.filter((i) => i.weekNumber === week);
        if (weekItems.length > 0) monthlyGroups.push({ title: `Week ${week}`, items: weekItems });
      }
      const extras = monthlyItems.filter((i) => !i.weekNumber);
      if (extras.length > 0) monthlyGroups.push({ title: 'Other Items', items: extras });
      groups.push({ title: 'Monthly Plan', items: [], groupedItems: monthlyGroups });
    }
    return groups;
  };

  // ── Post-payment confirmed order panel ─────────────────────────────────────
  if (confirmedOrder) {
    const isReady = confirmedOrder.status === 'READY' || !!confirmedOrder.pickup_code;
    const isPendingFulfillment = confirmedOrder.status === 'PENDING_FULFILLMENT';
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Header />
        <View style={styles.titleArea}>
          <BreadCrumb />
          <Text style={styles.pageTitle}>Order Confirmed</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 0 }}>
          <View style={styles.confirmedCard}>
            <Text style={styles.orderIdText}>Order #{confirmedOrder.id}</Text>
            {isReady && !isPendingFulfillment ? (
              <>
                <Text style={styles.readyEmoji}>🎉</Text>
                <Text style={styles.readyTitle}>Your order is ready!</Text>
                <Text style={styles.readySubtitle}>
                  Scan the QR code at the vending machine to collect your food.
                </Text>
                {/* QR code — 180×180 */}
                <View style={styles.qrWrap}>
                  <RNImage
                    source={{
                      uri:
                        confirmedOrder.qr_code_url ||
                        `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${confirmedOrder.pickup_code}`,
                    }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.pickupCodeLabel}>Pickup Code</Text>
                <Text style={styles.pickupCode}>{confirmedOrder.pickup_code}</Text>
              </>
            ) : (
              <>
                <Text style={styles.readyEmoji}>⚠️</Text>
                <Text style={[styles.readyTitle, { color: '#B45309' }]}>Payment Confirmed</Text>
                <Text style={{ color: '#D97706', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                  Your payment was successful but we couldn't generate your pickup code automatically.
                </Text>
                {!!retryError && <Text style={{ color: Colors.error, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>{retryError}</Text>}
                <TouchableOpacity
                  style={[styles.retryBtn, (retrying || confirmedOrder.fulfillment_attempts >= 5) && { opacity: 0.5 }]}
                  onPress={handleRetryFulfillment}
                  disabled={retrying || confirmedOrder.fulfillment_attempts >= 5}>
                  {retrying ? <ActivityIndicator color="#fff" /> : <Text style={styles.retryBtnText}>🔄 Retry Pickup Code</Text>}
                </TouchableOpacity>
                {confirmedOrder.fulfillment_attempts >= 5 && (
                  <Text style={{ fontSize: 12, color: Colors.neutralGray, marginTop: 8 }}>Maximum retries reached. Please contact support.</Text>
                )}
              </>
            )}
            <TouchableOpacity
              style={styles.viewOrdersBtn}
              onPress={() => navigation.navigate('MyOrders')}>
              <Text style={styles.viewOrdersBtnText}>View My Orders</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <MobileFooterNav />
      </View>
    );
  }

  // ── Main cart view ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header />

      {/* Title + Clear Cart */}
      <View style={styles.titleArea}>
        <BreadCrumb />
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>{getMainTitle()}</Text>
          {items.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setShowClearDialog(true)}>
              <Trash2 size={18} color="#EF4444" />
              <Text style={styles.clearBtnText}>Clear Cart</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 0 }}
          showsVerticalScrollIndicator={false}>

          {/* Stock alerts — bg-yellow-50 */}
          {stockAlerts.length > 0 && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertTitle}>Stock Updates</Text>
              {stockAlerts.map((alert, i) => <Text key={i} style={styles.alertText}>• {alert}</Text>)}
            </View>
          )}

          {/* Sweets minimum order warning */}
          {summary.isSweets && !summary.isMinimumMet && (
            <View style={styles.minimumBanner}>
              <Info size={20} color="#C2410C" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: '#9A3412', fontWeight: '700', fontSize: 16 }}>Minimum Order Requirement</Text>
                <Text style={{ color: '#C2410C', fontSize: 14 }}>
                  Dosta Sweets requires a minimum subtotal of AED 100.00. Current: AED {summary.subtotal.toFixed(2)}.
                </Text>
              </View>
            </View>
          )}

          {/* Sweets delivery info card */}
          {cartData?.plan_type === 'SWEETS' && sweetsDeliveryInfo && (
            <View style={styles.deliveryInfoCard}>
              <Text style={styles.deliveryInfoTitle}>Delivery Details</Text>
              <View style={styles.deliveryInfoRow}>
                <Text style={styles.deliveryInfoLabel}>Address:</Text>
                <Text style={styles.deliveryInfoValue}>{sweetsDeliveryInfo.address}</Text>
              </View>
              <View style={styles.deliveryInfoRow}>
                <Text style={styles.deliveryInfoLabel}>Phone:</Text>
                <Text style={styles.deliveryInfoValue}>{sweetsDeliveryInfo.phone}</Text>
              </View>
            </View>
          )}

          {/* Beit Nahla delivery info card */}
          {summary.hasBeitNahla && beitNahlaDeliveryInfo && (
            <View style={styles.deliveryInfoCard}>
              <Text style={styles.deliveryInfoTitle}>Beit Nahla Delivery</Text>
              {!!beitNahlaDeliveryInfo.name && (
                <View style={styles.deliveryInfoRow}>
                  <Text style={styles.deliveryInfoLabel}>Name:</Text>
                  <Text style={styles.deliveryInfoValue}>{beitNahlaDeliveryInfo.name}</Text>
                </View>
              )}
              <View style={styles.deliveryInfoRow}>
                <Text style={styles.deliveryInfoLabel}>Address:</Text>
                <Text style={styles.deliveryInfoValue}>{beitNahlaDeliveryInfo.address}</Text>
              </View>
              <View style={styles.deliveryInfoRow}>
                <Text style={styles.deliveryInfoLabel}>Phone:</Text>
                <Text style={styles.deliveryInfoValue}>{beitNahlaDeliveryInfo.phone}</Text>
              </View>
              {beitNahlaDeliveryInfo.distance_km != null && (
                <View style={styles.deliveryInfoRow}>
                  <Text style={styles.deliveryInfoLabel}>Distance:</Text>
                  <Text style={styles.deliveryInfoValue}>
                    {beitNahlaDeliveryInfo.distance_km} km
                    {beitNahlaDeliveryInfo.mode === 'WEEKLY' ? '  ·  Weekly' : '  ·  Order Now'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Cart groups */}
          {getGroupedCartItems().map((group, idx) => (
            <OrderList
              key={idx}
              title={group.title}
              items={group.items}
              groupedItems={group.groupedItems}
              onQtyChange={handleQuantityChange}
              onDelete={handleDeleteItem}
              onHeatingChange={handleHeatingChange}
            />
          ))}

          {/* Empty cart */}
          {items.length === 0 && (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyCartText}>Your cart is empty.</Text>
              <TouchableOpacity
                style={styles.goShoppingBtn}
                onPress={() => navigation.navigate('VendingHome')}>
                <Text style={styles.goShoppingText}>Go Shopping</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Order Summary */}
          {items.length > 0 && (
            <OrderSummary
              subtotal={summary.subtotal}
              vat={summary.vat}
              discount={summary.discount}
              deliveryCharge={summary.deliveryCharge}
              serviceCharge={summary.serviceCharge}
              city={summary.city}
              total={summary.total}
              coupon={coupon}
              setCoupon={setCoupon}
              onCheckout={async () => {
                const token = await getAuthToken();
                if (!token) { setShowAuthModal(true); return; }

                // ── Beit Nahla checkout ──────────────────────────────────
                // Posts to the catering backend (it doesn't go through the
                // vending payment gateway — it's not tied to a machine). On
                // success we clear the Beit Nahla cart and toast. Faithful
                // port of web pages/CartPage.tsx.
                if (summary.hasBeitNahla) {
                  const bnItems = items.filter((i) => i.planType === 'BEIT_NAHLA');
                  // Pull the original snapshot for selections_summary text
                  // (mapCartToUI strips the per-box description).
                  const bnRaw = (await getBeitNahlaCart()) || { items: [] };
                  const summariesByMenuId: Record<number, string> = {};
                  (bnRaw.items || []).forEach((raw: any) => {
                    const k = Number(raw.menu_item?.id ?? raw.id);
                    summariesByMenuId[k] = raw.menu_item?.description || '';
                  });

                  const mode =
                    (beitNahlaDeliveryInfo?.mode as 'ORDER_NOW' | 'WEEKLY') || 'ORDER_NOW';

                  const payload = {
                    mode,
                    customer_name:  beitNahlaDeliveryInfo?.name || '',
                    customer_phone: beitNahlaDeliveryInfo?.phone || sweetsDeliveryInfo?.phone || '',
                    building:       beitNahlaDeliveryInfo?.building || '',
                    street:         beitNahlaDeliveryInfo?.street || '',
                    appt:           beitNahlaDeliveryInfo?.appt || '',
                    delivery_address: beitNahlaDeliveryInfo?.address || '',
                    latitude:       beitNahlaDeliveryInfo?.latitude ?? null,
                    longitude:      beitNahlaDeliveryInfo?.longitude ?? null,
                    distance_km:    beitNahlaDeliveryInfo?.distance_km ?? null,
                    tier_label:     beitNahlaDeliveryInfo?.tier_label || '',
                    subtotal:       summary.subtotal,
                    vat:            summary.vat,
                    discount:       summary.discount,
                    service_charge: summary.serviceCharge,
                    delivery_charge: summary.deliveryCharge,
                    total_amount:   summary.total,
                    items: bnItems.map((it) => ({
                      meal_box_id:        it.menuItemId,
                      box_name:           it.name,
                      unit_price:         it.price,
                      quantity:           it.quantity,
                      selections_summary: summariesByMenuId[it.menuItemId] || '',
                    })),
                  };

                  try {
                    setIsCheckingOut(true);
                    await axios.post(
                      `${BASE_URL}/api/catering/beit-nahla/orders/create/`,
                      payload,
                      { headers: { Authorization: `Token ${token}` } },
                    );
                    await removeBeitNahlaCart();
                    await removeBeitNahlaDeliveryInfo();
                    Toast.show({
                      type: 'success',
                      text1: 'Beit Nahla order placed!',
                      text2: 'The kitchen will start preparing it shortly.',
                    });
                    dispatch(syncLocalCart([]));
                    setItems((prev) => prev.filter((i) => i.planType !== 'BEIT_NAHLA'));
                    setBeitNahlaDeliveryInfo(null);
                  } catch (err: any) {
                    Toast.show({
                      type: 'error',
                      text1: err?.response?.data?.error || 'Failed to place Beit Nahla order. Please try again.',
                    });
                  } finally {
                    setIsCheckingOut(false);
                  }
                  return;
                }

                // ── UAE Order Time Restriction ───────────────────────────
                // Faithful port of web pages/CartPage.tsx processCheckout.
                // WEEKLY / MONTHLY / SWEETS carts can only check out
                // between 07:00 and 18:00 UAE time (UTC+4). Order Now and
                // Smart Grab are unrestricted.
                if (cartData) {
                  const isTimedPlan =
                    cartData.plan_subtype === 'WEEKLY' ||
                    cartData.plan_subtype === 'MONTHLY' ||
                    cartData.plan_type    === 'SWEETS';
                  if (isTimedPlan) {
                    const now = new Date();
                    const uaeHour = new Date(
                      now.getTime() +
                        (now.getTimezoneOffset() + 4 * 60) * 60_000,
                    ).getHours();
                    if (uaeHour < 7 || uaeHour >= 18) {
                      setShowOrderTimeModal(true);
                      return;
                    }
                  }
                }

                setShowPaymentDialog(true);
              }}
              loading={isCheckingOut}
              disabled={items.length === 0 || !summary.isMinimumMet}
            />
          )}
        </ScrollView>
      )}

      {/* Payment confirm */}
      <ConfirmDialog
        visible={showPaymentDialog}
        title="Confirm Payment"
        description="You are about to be redirected to our secure payment gateway to complete your purchase."
        confirmLabel={isCheckingOut ? 'Processing...' : 'Confirm & Pay'}
        confirmStyle={{ backgroundColor: Colors.primary }}
        onConfirm={processCheckout}
        onCancel={() => setShowPaymentDialog(false)}
      />

      {/* Clear cart confirm */}
      <ConfirmDialog
        visible={showClearDialog}
        title="Are you absolutely sure?"
        description="This action cannot be undone. This will permanently remove all items from your cart."
        confirmLabel="Clear Cart"
        confirmStyle={{ backgroundColor: '#EF4444' }}
        onConfirm={handleClearCart}
        onCancel={() => setShowClearDialog(false)}
      />

      {/* Out-of-hours block for WEEKLY / MONTHLY / SWEETS carts */}
      <OrderTimeRestrictionModal
        visible={showOrderTimeModal}
        onClose={() => setShowOrderTimeModal(false)}
      />

      <MobileFooterNav />
      <AuthPromptModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="Please log in to proceed to checkout. Don't have an account? Sign up for free!"
        returnTo={{ name: 'Cart' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  titleArea: {
    backgroundColor: Colors.neutralWhite,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: 0.1,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearBtnText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  // CartItem
  cartItemRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cartItemImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  cartItemBody: { flex: 1 },
  cartItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.neutralBlack,
    lineHeight: 24,
  },
  cartItemNote: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutralGrayDark,
    lineHeight: 16,
  },
  cartItemLocation: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutralGrayDark,
  },
  cartItemLocationBold: {
    color: Colors.neutralBlack,
    fontWeight: '600',
  },
  heatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  heatingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutralGrayDark,
  },
  heatingToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 6,
    padding: 4,
  },
  heatingBtn: {
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 4,
  },
  heatingBtnActive: {
    backgroundColor: Colors.neutralWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  heatingBtnText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  heatingBtnTextActive: { color: Colors.neutralBlack },
  cartItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    padding: 6,
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 4,
  },
  qtyText: {
    paddingHorizontal: 10,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutralBlack,
  },
  cartItemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  deleteIcon: { width: 24, height: 24 },
  // OrderList
  orderListCard: {
    backgroundColor: Colors.neutralWhite,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    padding: 16,
    marginBottom: 16,
  },
  orderListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  orderListTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.neutralBlack,
    lineHeight: 32,
  },
  orderListCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#83859C',
    lineHeight: 16,
  },
  orderListItems: { gap: 16 },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutralBlack,
    marginBottom: 16,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 16,
  },
  addMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  addMoreText: {
    color: Colors.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  // OrderSummary
  summaryCard: {
    backgroundColor: Colors.neutralWhite,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.neutralBlack,
    marginBottom: 16,
    lineHeight: 36,
  },
  couponWrap: { marginBottom: 24 },
  couponLabel: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 },
  couponRow: { position: 'relative' },
  couponInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 44,
    fontSize: 14,
    color: Colors.neutralBlack,
    backgroundColor: Colors.neutralWhite,
  },
  tickIcon: { position: 'absolute', right: 12, top: 6, width: 24, height: 24 },
  priceRows: { gap: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between' },
  priceLabel: { color: Colors.neutralGrayDark, fontSize: 14 },
  priceValue: { fontWeight: '500', fontSize: 14, color: Colors.neutralBlack },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: { fontSize: 16, fontWeight: '600', color: Colors.neutralBlack },
  totalValue: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  checkoutBtnDisabled: { opacity: 0.6 },
  checkoutBtnText: { color: Colors.neutralWhite, fontWeight: '700', fontSize: 14 },
  // Banners
  alertBanner: {
    backgroundColor: '#FEFCE8',
    borderWidth: 1,
    borderColor: '#FEF08A',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  alertTitle: { color: '#854D0E', fontWeight: '700', marginBottom: 8 },
  alertText: { color: '#A16207', fontSize: 12 },
  minimumBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  deliveryInfoCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  deliveryInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
  },
  deliveryInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  deliveryInfoLabel: { color: '#83859C', fontSize: 14, fontWeight: '500', width: 80 },
  deliveryInfoValue: { color: Colors.neutralBlack, fontSize: 14, fontWeight: '700', flex: 1 },
  // Empty cart
  emptyCart: { backgroundColor: Colors.neutralWhite, borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, padding: 40, alignItems: 'center' },
  emptyCartText: { color: Colors.neutralGray, marginBottom: 16 },
  goShoppingBtn: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  goShoppingText: { color: Colors.neutralWhite, fontWeight: '700' },
  // Confirmed order
  confirmedCard: {
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    padding: 32,
    alignItems: 'center',
  },
  orderIdText: { fontSize: 13, color: '#83859C', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  readyEmoji: { fontSize: 48, marginBottom: 12 },
  readyTitle: { fontSize: 22, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  readySubtitle: { fontSize: 14, color: '#83859C', textAlign: 'center', marginBottom: 24 },
  qrWrap: { borderWidth: 1, borderColor: '#83859C', borderRadius: 16, width: 180, height: 180, padding: 12, backgroundColor: Colors.neutralWhite, marginBottom: 16 },
  qrImage: { width: '100%', height: '100%' },
  pickupCodeLabel: { fontSize: 14, color: '#83859C', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  pickupCode: { fontSize: 40, fontWeight: '900', color: Colors.primary, marginBottom: 24 },
  retryBtn: { backgroundColor: Colors.orange, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 12 },
  retryBtnText: { color: Colors.neutralWhite, fontWeight: '700' },
  viewOrdersBtn: { borderWidth: 1, borderColor: Colors.primary, paddingVertical: 12, borderRadius: 12, width: '100%', alignItems: 'center' },
  viewOrdersBtnText: { color: Colors.primary, fontWeight: '600' },
});
