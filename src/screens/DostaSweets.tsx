/**
 * DostaSweets — faithful translation of:
 *   web: pages/catering/Sweets.tsx → components/Sweets/SweetsMenu.tsx + SweetsCard.tsx
 *
 * Mobile-only viewport rules followed (mirroring web mobile):
 *   - Section header: white bg, blue heading text-3xl, gray description
 *   - Cards in a 2-col grid (web: grid-cols-2)
 *   - Right "Your Sweets" sidebar is `lg:` only on web → hidden on mobile
 *   - Sticky bottom strip: items count, total, "Confirm Selection"
 *   - Item detail: slides in from RIGHT (not bottom) — matches web exactly
 *   - Delivery modal: centered card with phone validation, 3 cities
 *   - Min-order error: separate centered modal
 *   - Success toaster: top-center, auto-dismiss after 1500ms then nav to Cart
 *
 * Logic preserved 1:1:
 *   - Variation selection per card
 *   - Quantity stepper / Plus button on card
 *   - cartItem key = `${id}-${variationId||0}`
 *   - Min order AED 100 for non-Dubai cities
 *   - Delivery: AED 40 for non-Dubai
 *   - On confirm: POST /api/vending/cart/ plan_type=SWEETS, navigate to Cart
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, ActivityIndicator,
  StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { Minus, Plus, X, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { MotiView } from 'moti';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import BreadCrumb from '@/components/ui/BreadCrumb';
import Shimmer from '@/components/ui/Shimmer';
import { syncLocalCart } from '@/store/slices/cartSlice';
import { getAuthToken, setSweetsDeliveryInfo, getSelectedLocation, setGuestCart } from '@/utils/storage';
import { BASE_URL } from '@/services/api';

const { width: W } = Dimensions.get('window');

// Web supports only Dubai/Sharjah/Ajman in the city picker
const CITIES = ['Dubai', 'Sharjah', 'Ajman'];

// ─────────────────────────────────────────────────────────────────────────────
// Types — shape mirrors web/components/Sweets/SweetsCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
interface SweetsItemImage     { id: number; image_url: string; alt_text: string; order: number; }
interface SweetsItemVariation { id: number; weight: string; price: string; }
interface SweetsItemType {
  id: number;
  heading: string;
  description: string;
  price: string;       // "AED 35.00"
  imgSrc: string | null;
  images: SweetsItemImage[];
  imgAlt: string;
  variations?: SweetsItemVariation[];
}
interface SelectedSweetsItem extends SweetsItemType {
  quantity: number;
  selectedVariation?: SweetsItemVariation;
}

// ─────────────────────────────────────────────────────────────────────────────
// SweetsCard — translation of web SweetsCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
const SweetsCard = ({
  data,
  cartItems,
  handleCardClick,
  handleQuantityChange,
}: {
  data: SweetsItemType;
  cartItems: SelectedSweetsItem[];
  handleCardClick: (item: SweetsItemType, variation?: SweetsItemVariation) => void;
  handleQuantityChange: (item: SweetsItemType, delta: number, variation?: SweetsItemVariation) => void;
}) => {
  const [selectedVariation, setSelectedVariation] = useState<SweetsItemVariation | undefined>(
    data.variations && data.variations.length > 0 ? data.variations[0] : undefined,
  );
  const [imgIndex, setImgIndex] = useState(0);

  const allImages = useMemo(
    () =>
      data.images && data.images.length > 0
        ? data.images.map((img) => img.image_url)
        : [data.imgSrc || 'https://placehold.co/400x300?text=Sweets'],
    [data.images, data.imgSrc],
  );

  const itemInCart = cartItems.find(
    (i) => i.id === data.id && i.selectedVariation?.id === (selectedVariation?.id || 0),
  );

  const currentPrice = selectedVariation
    ? `AED ${parseFloat(selectedVariation.price).toFixed(2)}`
    : data.price;

  const stepImg = (delta: 1 | -1) => {
    setImgIndex((p) =>
      delta > 0
        ? (p === allImages.length - 1 ? 0 : p + 1)
        : (p === 0 ? allImages.length - 1 : p - 1),
    );
  };

  return (
    <TouchableOpacity
      style={[card.outer, itemInCart && card.outerActive]}
      onPress={() => handleCardClick(data, selectedVariation)}
      activeOpacity={0.9}>
      {/* Image with carousel arrows */}
      <View style={card.imgWrap}>
        <Image source={{ uri: allImages[imgIndex] }} style={card.img} contentFit="cover" transition={200} />

        {allImages.length > 1 && (
          <>
            <TouchableOpacity
              style={[card.imgArrow, { left: 6 }]}
              onPress={(e) => { e.stopPropagation?.(); stepImg(-1); }}>
              <ChevronLeft size={14} color={Colors.neutralBlack} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[card.imgArrow, { right: 6 }]}
              onPress={(e) => { e.stopPropagation?.(); stepImg(1); }}>
              <ChevronRight size={14} color={Colors.neutralBlack} />
            </TouchableOpacity>
            <View style={card.dots}>
              {allImages.map((_, i) => (
                <View key={i} style={[card.dot, i === imgIndex && card.dotActive]} />
              ))}
            </View>
          </>
        )}

        {itemInCart && (
          <View style={card.badge}>
            <Text style={card.badgeText}>
              {itemInCart.selectedVariation?.weight || 'Added'}
            </Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={card.body}>
        <Text style={card.heading} numberOfLines={1}>{data.heading}</Text>
        <Text style={card.desc} numberOfLines={2}>
          {data.description || 'A delicious sweet treat.'}
        </Text>

        {/* Variation chips — only when 2+ variations (web: length > 1) */}
        {data.variations && data.variations.length > 1 && (
          <View style={card.varRow}>
            {data.variations.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[card.varChip, selectedVariation?.id === v.id && card.varChipActive]}
                onPress={(e) => { e.stopPropagation?.(); setSelectedVariation(v); }}>
                <Text style={[
                  card.varChipText,
                  selectedVariation?.id === v.id && card.varChipTextActive,
                ]}>
                  {v.weight}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Price + qty/add */}
        <View style={card.footer}>
          <View style={{ flexShrink: 1 }}>
            <Text style={card.price} numberOfLines={1}>{currentPrice}</Text>
            {selectedVariation && data.variations && data.variations.length > 1 && (
              <Text style={card.perWeight}>Per {selectedVariation.weight}</Text>
            )}
          </View>

          {itemInCart ? (
            <View style={card.qtyRow}>
              <TouchableOpacity
                style={card.qtyBtn}
                onPress={(e) => { e.stopPropagation?.(); handleQuantityChange(data, -1, itemInCart.selectedVariation); }}>
                <Minus size={12} color={Colors.neutralBlack} />
              </TouchableOpacity>
              <Text style={card.qtyText}>{itemInCart.quantity}</Text>
              <TouchableOpacity
                style={card.qtyBtn}
                onPress={(e) => { e.stopPropagation?.(); handleQuantityChange(data, 1, itemInCart.selectedVariation); }}>
                <Plus size={12} color={Colors.neutralBlack} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={card.plusBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                handleQuantityChange(data, 1, selectedVariation);
              }}>
              <Plus size={16} color={Colors.neutralWhite} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ItemDetailSidebar — slides in from right (web: flex justify-end + initial x:100%)
// ─────────────────────────────────────────────────────────────────────────────
const ItemDetailSidebar = ({
  item, onClose, onAdd, cartItems,
}: {
  item: SweetsItemType | null;
  cartItems: SelectedSweetsItem[];
  onClose: () => void;
  onAdd: (item: SweetsItemType, qty: number, variation?: SweetsItemVariation) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [selectedVariation, setSelectedVariation] = useState<SweetsItemVariation | undefined>(undefined);
  const [imgIndex, setImgIndex] = useState(0);
  const [modalQty, setModalQty] = useState(1);

  // Re-init when item changes — sync to cart if already added
  useEffect(() => {
    if (!item) return;
    const v = item.variations && item.variations.length > 0 ? item.variations[0] : undefined;
    setSelectedVariation(v);
    setImgIndex(0);
    const inCart = cartItems.find(
      (c) => c.id === item.id && c.selectedVariation?.id === (v?.id || 0),
    );
    setModalQty(inCart?.quantity || 1);
  }, [item?.id]);

  if (!item) return null;

  const allImages =
    item.images && item.images.length > 0
      ? item.images.map((img) => img.image_url)
      : [item.imgSrc || 'https://placehold.co/800x600?text=Sweets'];

  const priceNum = parseFloat(
    (selectedVariation?.price || item.price || '0').toString().replace('AED ', ''),
  );
  const subtotal = priceNum * modalQty;

  return (
    <Modal visible={!!item} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={sb.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <MotiView
          from={{ translateX: W }}
          animate={{ translateX: 0 }}
          exit={{ translateX: W }}
          transition={{ type: 'spring', stiffness: 250, damping: 30 }}
          style={[sb.panel, { paddingTop: insets.top }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Header — title + close X */}
            <View style={sb.header}>
              <Text style={sb.title} numberOfLines={2}>{item.heading}</Text>
              <TouchableOpacity style={sb.closeBtn} onPress={onClose}>
                <X size={20} color={Colors.neutralGrayDark} />
              </TouchableOpacity>
            </View>

            {/* Image carousel — touch swipe is approximated by tapping the arrows */}
            <View style={sb.imgWrap}>
              <Image source={{ uri: allImages[imgIndex] }} style={sb.img} contentFit="cover" transition={200} />
              {allImages.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[sb.imgArrow, { left: 8 }]}
                    onPress={() => setImgIndex((p) => p === 0 ? allImages.length - 1 : p - 1)}>
                    <ChevronLeft size={20} color={Colors.neutralBlack} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[sb.imgArrow, { right: 8 }]}
                    onPress={() => setImgIndex((p) => p === allImages.length - 1 ? 0 : p + 1)}>
                    <ChevronRight size={20} color={Colors.neutralBlack} />
                  </TouchableOpacity>
                  <View style={sb.imgPager}>
                    <Text style={sb.imgPagerText}>{imgIndex + 1}/{allImages.length}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={sb.body}>
              <Text style={sb.desc}>{item.description || 'A delicious sweet treat.'}</Text>

              {/* Variations */}
              {item.variations && item.variations.length > 0 && (
                <View style={sb.varBlock}>
                  <Text style={sb.varLabel}>Select Weight</Text>
                  <View style={sb.varRow}>
                    {item.variations.map((v) => (
                      <TouchableOpacity
                        key={v.id}
                        style={[
                          sb.varChip,
                          selectedVariation?.id === v.id && sb.varChipActive,
                        ]}
                        onPress={() => setSelectedVariation(v)}>
                        <Text style={[
                          sb.varChipWeight,
                          selectedVariation?.id === v.id && { color: Colors.primary },
                        ]}>
                          {v.weight}
                        </Text>
                        <Text style={[
                          sb.varChipPrice,
                          selectedVariation?.id === v.id && { color: Colors.primary },
                        ]}>
                          AED {parseFloat(v.price).toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Quantity row — gray bg per web */}
              <View style={sb.qtyBlock}>
                <Text style={sb.qtyLabel}>Quantity</Text>
                <View style={sb.qtyRow}>
                  <TouchableOpacity
                    style={sb.qtyStepBtn}
                    onPress={() => setModalQty((q) => Math.max(1, q - 1))}>
                    <Minus size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={sb.qtyValue}>{modalQty}</Text>
                  <TouchableOpacity
                    style={sb.qtyStepBtn}
                    onPress={() => setModalQty((q) => q + 1)}>
                    <Plus size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Subtotal */}
              <View style={sb.subtotalRow}>
                <Text style={sb.subtotalLabel}>Subtotal</Text>
                <Text style={sb.subtotalValue}>AED {subtotal.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Footer actions — Close + Add to selection (sticky) */}
          <View style={[sb.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={sb.closeAction} onPress={onClose} activeOpacity={0.85}>
              <Text style={sb.closeActionText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={sb.addAction}
              onPress={() => { onAdd(item, modalQty, selectedVariation); onClose(); }}
              activeOpacity={0.85}>
              <Text style={sb.addActionText}>Add to selection</Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DeliveryModal — centered card matching web AnimatePresence dialog
// ─────────────────────────────────────────────────────────────────────────────
const DeliveryModal = ({
  visible, onClose, onSubmit, cartSubtotal,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { appt: string; building: string; street: string; phone: string; city: string }) => void;
  cartSubtotal: number;
}) => {
  const [appt,     setAppt]     = useState('');
  const [building, setBuilding] = useState('');
  const [street,   setStreet]   = useState('');
  const [phone,    setPhone]    = useState('');
  const [city,     setCity]     = useState('Dubai');

  const phoneInvalidStart = phone.length > 0 && !phone.startsWith('05');
  const phoneTooShort     = phone.length > 0 && phone.startsWith('05') && phone.length < 10;
  const phoneOk           = phone.startsWith('05') && phone.length === 10;
  const submitDisabled    = !appt.trim() || !building.trim() || !street.trim() || !phoneOk;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={dm.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <MotiView
          from={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={dm.panel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={dm.headerRow}>
              <Text style={dm.title}>Delivery Details</Text>
              <TouchableOpacity style={dm.closeBtn} onPress={onClose}>
                <X size={20} color={Colors.neutralGrayDark} />
              </TouchableOpacity>
            </View>

            <Text style={dm.subtitle}>
              Please provide your delivery address and phone number to complete your Sweets order.
            </Text>

            {/* Phone */}
            <View style={dm.field}>
              <Text style={dm.label}>Phone Number</Text>
              <TextInput
                style={[
                  dm.input,
                  (phoneInvalidStart || phoneTooShort) && dm.inputError,
                ]}
                placeholder="05X XXX XXXX"
                placeholderTextColor={Colors.neutralGray}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9]/g, '').slice(0, 10))}
              />
              {phoneInvalidStart && (
                <Text style={dm.errorText}>Number must start with 05</Text>
              )}
              {phoneTooShort && (
                <Text style={dm.errorText}>Enter all 10 digits (e.g. 0501234567)</Text>
              )}
            </View>

            {/* City */}
            <View style={dm.field}>
              <Text style={dm.label}>Select City</Text>
              <View style={dm.cityRow}>
                {CITIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[dm.cityBtn, city === c && dm.cityBtnActive]}
                    onPress={() => setCity(c)}>
                    <Text style={[dm.cityBtnText, city === c && dm.cityBtnTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {city !== 'Dubai' && (
                <Text style={dm.deliveryNote}>+ AED 40.00 Delivery Charge</Text>
              )}
            </View>

            {/* Building (full width) */}
            <View style={dm.field}>
              <Text style={dm.label}>Building</Text>
              <TextInput
                style={dm.input}
                placeholder="Building Name/Number"
                placeholderTextColor={Colors.neutralGray}
                value={building}
                onChangeText={setBuilding}
              />
            </View>

            {/* Street + Appt (2-col grid) */}
            <View style={dm.gridRow}>
              <View style={[dm.field, { flex: 1, marginRight: 8 }]}>
                <Text style={dm.label}>Street</Text>
                <TextInput
                  style={dm.input}
                  placeholder="Street Name"
                  placeholderTextColor={Colors.neutralGray}
                  value={street}
                  onChangeText={setStreet}
                />
              </View>
              <View style={[dm.field, { flex: 1, marginLeft: 8 }]}>
                <Text style={dm.label}>Appt</Text>
                <TextInput
                  style={dm.input}
                  placeholder="Appt Number"
                  placeholderTextColor={Colors.neutralGray}
                  value={appt}
                  onChangeText={setAppt}
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer actions */}
          <View style={dm.footer}>
            <TouchableOpacity style={dm.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={dm.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dm.continueBtn, submitDisabled && dm.continueBtnDisabled]}
              disabled={submitDisabled}
              activeOpacity={0.85}
              onPress={() => onSubmit({ appt, building, street, phone, city })}>
              <Text style={dm.continueBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MinOrderErrorModal — separate centered popup for delivery min-order issue
// ─────────────────────────────────────────────────────────────────────────────
const MinOrderErrorModal = ({
  visible, onClose, city, subtotal,
}: {
  visible: boolean; onClose: () => void; city: string; subtotal: number;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={mo.backdrop}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <MotiView
        from={{ scale: 0.95, opacity: 0, translateY: 20 }}
        animate={{ scale: 1, opacity: 1, translateY: 0 }}
        exit={{ scale: 0.95, opacity: 0, translateY: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        style={mo.panel}>
        <View style={mo.iconCircle}>
          <AlertTriangle size={28} color="#F97316" />
        </View>
        <Text style={mo.title}>Minimum Order Not Met</Text>
        <Text style={mo.body}>
          The minimum order requirement for delivery to{' '}
          <Text style={{ fontWeight: '700', color: Colors.primary }}>{city}</Text>{' '}
          is AED 100.00. Please add{' '}
          <Text style={{ fontWeight: '700', color: '#EA580C' }}>
            AED {(100 - subtotal).toFixed(2)}
          </Text>{' '}
          more to your cart to proceed with checkout.
        </Text>
        <TouchableOpacity style={mo.btn} onPress={onClose} activeOpacity={0.85}>
          <Text style={mo.btnText}>Add More Sweets</Text>
        </TouchableOpacity>
      </MotiView>
    </View>
  </Modal>
);

// ─────────────────────────────────────────────────────────────────────────────
// Toaster — top-center, auto-dismissed by parent
// ─────────────────────────────────────────────────────────────────────────────
const SuccessToaster = ({ visible }: { visible: boolean }) => {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <View pointerEvents="none" style={[toast.wrap, { top: insets.top + 16 }]}>
      <MotiView
        from={{ opacity: 0, translateY: -16 }}
        animate={{ opacity: 1, translateY: 0 }}
        exit={{ opacity: 0, translateY: -16 }}
        transition={{ type: 'timing', duration: 250 }}
        style={toast.bar}>
        <CheckCircle2 size={20} color="#34C759" />
        <Text style={toast.text}>Sweets successfully confirmed!</Text>
      </MotiView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function DostaSweets() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const dispatch   = useDispatch();

  const [sweetsData,        setSweetsData]        = useState<SweetsItemType[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState<string | null>(null);
  const [cart,              setCart]              = useState<SelectedSweetsItem[]>([]);
  const [selectedItem,      setSelectedItem]      = useState<SweetsItemType | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showMinOrderError, setShowMinOrderError] = useState(false);
  const [submitting,        setSubmitting]        = useState(false);
  const [selectedCity,      setSelectedCity]      = useState('Dubai');
  const [toaster,           setToaster]           = useState(false);

  // Derived totals
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => {
    const priceNum = parseFloat((item.price || '0').replace('AED ', ''));
    return sum + priceNum * item.quantity;
  }, 0);
  const deliveryCharge = selectedCity === 'Dubai' ? 0 : 40;
  const totalPrice     = subtotal + (cart.length > 0 ? deliveryCharge : 0);

  // ── Fetch sweets menu (matches web) ────────────────────────────────────────
  useEffect(() => {
    const fetchSweetsMenu = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAuthToken();
        const headers = token ? { Authorization: `Token ${token}` } : {};
        const res = await axios.get(`${BASE_URL}/api/catering/sweets-menu/`, { headers });
        const items: SweetsItemType[] = res.data.map((it: any) => ({
          id:          it.id,
          heading:     it.name,
          description: it.description,
          price:       `AED ${parseFloat(it.price).toFixed(2)}`,
          imgSrc:      it.image_url,
          images:      it.images || [],
          imgAlt:      `sweets-${it.id}`,
          variations:  it.variations || [],
        }));
        setSweetsData(items);
      } catch {
        setError('Failed to load sweets menu.');
      } finally {
        setLoading(false);
      }
    };
    fetchSweetsMenu();
  }, []);

  // Sync redux when the user empties the cart by removing the last item (so
  // the navbar badge drops to 0). We deliberately DON'T fire on the initial
  // mount-with-empty-cart, because that would clobber any cart already
  // sitting in Redux/AsyncStorage from a prior add (vending, weekly meal,
  // sweets from a previous session). Tracked via a ref to the previous len.
  const prevCartLen = useRef(0);
  useEffect(() => {
    if (prevCartLen.current > 0 && cart.length === 0) {
      dispatch(syncLocalCart([]));
    }
    prevCartLen.current = cart.length;
  }, [cart.length, dispatch]);

  // ── handleQuantityChange — exact translation of web ────────────────────────
  const handleQuantityChange = (
    item: SweetsItemType,
    delta: number,
    variation?: SweetsItemVariation,
    absolute?: boolean,
  ) => {
    setCart((prevCart) => {
      const variationId = variation?.id || 0;
      const cartItemId = `${item.id}-${variationId}`;

      const existingIndex = prevCart.findIndex(
        (i) => `${i.id}-${i.selectedVariation?.id || 0}` === cartItemId,
      );

      if (existingIndex > -1) {
        const existing = prevCart[existingIndex];
        const newQ = absolute ? delta : existing.quantity + delta;
        if (newQ <= 0) {
          return prevCart.filter((_, idx) => idx !== existingIndex);
        }
        const next = [...prevCart];
        next[existingIndex] = { ...existing, quantity: newQ };
        return next;
      } else if (delta > 0) {
        const itemPrice = variation
          ? `AED ${parseFloat(variation.price).toFixed(2)}`
          : item.price;
        return [
          ...prevCart,
          { ...item, price: itemPrice, quantity: delta, selectedVariation: variation },
        ];
      }
      return prevCart;
    });
  };

  // ── handleConfirmOrder — exact translation of web (POST + redux + nav) ──────
  const handleConfirmOrder = async (chosenCity?: string) => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const token = await getAuthToken();
      let locId = 1;
      try {
        const sel = await getSelectedLocation();
        locId = Number(sel?.location?.id) || 1;
      } catch { locId = 1; }

      const activeCity = chosenCity || selectedCity;
      const activeDelivery = activeCity === 'Dubai' ? 0 : 40;

      // Redux items — match web shape exactly
      const reduxCartItems = cart.map((item) => ({
        id: Math.floor(Math.random() * 1000000),
        menu_item_id: item.id,
        menu_item: {
          id: item.id,
          name: item.selectedVariation
            ? `${item.heading} (${item.selectedVariation.weight})`
            : item.heading,
          price: (item.price || '0').replace('AED ', ''),
          image_url: item.imgSrc,
          heating: 'no',
          description: item.description,
        },
        heading: item.selectedVariation
          ? `${item.heading} (${item.selectedVariation.weight})`
          : item.heading,
        imgSrc: item.imgSrc,
        price: parseFloat((item.price || '0').replace('AED ', '')),
        quantity: item.quantity,
        day_of_week: null,
        week_number: null,
        vending_good_uuid: null,
        plan_type: 'SWEETS',
        plan_subtype: 'SWEETS',
      }));
      dispatch(syncLocalCart(reduxCartItems));

      const payload: any = {
        location_id:    locId,
        plan_type:      'SWEETS',
        plan_subtype:   'SWEETS',
        pickup_type:    'TODAY',
        pickup_date:    new Date().toISOString().split('T')[0],
        pickup_slot_id: null,
        city:           activeCity,
        delivery_charge: activeDelivery,
        items: cart.map((item) => ({
          id: item.id,
          menu_item_id: item.id,
          variation_id: item.selectedVariation?.id || null,
          quantity: item.quantity || 1,
          day_of_week: null,
          week_number: null,
          vending_good_uuid: null,
          plan_type: 'SWEETS',
          plan_subtype: 'SWEETS',
          menu_item: {
            id: item.id,
            name: item.selectedVariation
              ? `${item.heading} (${item.selectedVariation.weight})`
              : item.heading,
            price: (item.price || '0').toString().replace('AED ', ''),
            image_url: item.imgSrc,
            description: item.description || '',
          },
        })),
        current_step: 4,
      };

      try {
        if (token) {
          await axios.post(`${BASE_URL}/api/vending/cart/`, payload, {
            headers: { Authorization: `Token ${token}` },
          });
        } else {
          // Guest path — persist the full payload (location, plan_type, city,
          // delivery_charge, items, …) to AsyncStorage so the Cart screen can
          // re-render with the same metadata web stores in localStorage. Web
          // does this in SweetsMenu.handleConfirmOrder when no token exists.
          await setGuestCart(payload);
        }
      } catch (err) {
        // silent — match web's console.error behavior; redux is already synced
      }

      setToaster(true);
      setTimeout(() => {
        setToaster(false);
        navigation.navigate('Cart');
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  // ── submitDeliveryInfo — gates min-order, persists info, then confirms ─────
  const submitDeliveryInfo = async ({
    appt, building, street, phone, city,
  }: { appt: string; building: string; street: string; phone: string; city: string }) => {
    if (city !== 'Dubai' && subtotal < 100) {
      setSelectedCity(city);
      setShowDeliveryModal(false);
      setShowMinOrderError(true);
      return;
    }
    const combinedAddress = `${appt.trim()}, ${building.trim()}, ${street.trim()}`;
    await setSweetsDeliveryInfo({ address: combinedAddress, phone, city });
    setSelectedCity(city);
    setShowDeliveryModal(false);
    await handleConfirmOrder(city);
  };

  // Confirm-button gate — disabled when not Dubai and subtotal < 100
  const checkoutDisabled = cart.length === 0 || (selectedCity !== 'Dubai' && subtotal < 100);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <Header />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: cart.length > 0 ? 180 : 24 }}
        showsVerticalScrollIndicator={false}>
        <View style={s.container}>
          <BreadCrumb />

          {/* Section header — white bg, blue heading text-3xl */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Dosta Sweets</Text>
            <Text style={s.sectionSubtitle}>
              Delight in our premium selection of Middle Eastern and international sweets.
              Choose your treats below.
            </Text>
          </View>

          {/* Loading / error / grid */}
          {loading ? (
            <View style={s.grid}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={{ width: (W - 44) / 2, height: 280, marginBottom: 12 }}>
                  <Shimmer />
                </View>
              ))}
            </View>
          ) : error ? (
            <View style={s.errorBox}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {sweetsData.map((data) => (
                <SweetsCard
                  key={data.id}
                  data={data}
                  cartItems={cart}
                  handleCardClick={(item, variation) => setSelectedItem(item)}
                  handleQuantityChange={handleQuantityChange}
                />
              ))}
            </View>
          )}
        </View>

        {/* Footer sits INSIDE the scroll like in VendingMenuScreen — its
            intrinsic height is large, so keeping it outside the ScrollView
            squeezes the viewport and pushes MobileFooterNav up the screen. */}
        <Footer />
      </ScrollView>

      {/* Sticky Confirm bar — web: fixed bottom-[82px] (above mobile footer).
          MobileFooterNav height = 70 (row) + insets.bottom (safe-area), so we
          compute the bottom offset at runtime instead of using a static value
          that breaks on devices with a home indicator. */}
      {cart.length > 0 && (
        <View
          style={[s.cartBarWrap, { bottom: 70 + insets.bottom + 8 }]}
          pointerEvents="box-none">
          <View style={s.cartBar}>
            <View style={{ flex: 1 }}>
              <Text style={s.cartBarItems}>{totalQuantity} items</Text>
              <Text style={s.cartBarTotal}>AED {totalPrice.toFixed(2)}</Text>
              {selectedCity !== 'Dubai' && subtotal < 100 && (
                <Text style={s.cartBarMinOrder}>Min. order AED 100</Text>
              )}
            </View>
            <TouchableOpacity
              style={[s.cartBarBtn, checkoutDisabled && s.cartBarBtnDisabled]}
              disabled={checkoutDisabled || submitting}
              onPress={() => setShowDeliveryModal(true)}
              activeOpacity={0.85}>
              {submitting ? (
                <ActivityIndicator color={Colors.neutralWhite} size="small" />
              ) : (
                <Text style={s.cartBarBtnText}>Confirm Selection</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <MobileFooterNav />

      {/* Modals */}
      <ItemDetailSidebar
        item={selectedItem}
        cartItems={cart}
        onClose={() => setSelectedItem(null)}
        onAdd={(item, qty, variation) =>
          handleQuantityChange(item, qty, variation, /*absolute*/ true)
        }
      />

      <DeliveryModal
        visible={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        onSubmit={submitDeliveryInfo}
        cartSubtotal={subtotal}
      />

      <MinOrderErrorModal
        visible={showMinOrderError}
        onClose={() => setShowMinOrderError(false)}
        city={selectedCity}
        subtotal={subtotal}
      />

      <SuccessToaster visible={toaster} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: '#FAFAFD' },
  container: { paddingHorizontal: 16, paddingTop: 8 },

  sectionHeader:    { marginBottom: 16, marginTop: 4 },
  sectionTitle:     { fontSize: 28, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  sectionSubtitle:  { fontSize: 13, color: Colors.neutralGrayDark, lineHeight: 18 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  errorBox: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorText: { color: '#EF4444', fontSize: 14 },

  // Sticky cart bar — sits ABOVE the MobileFooterNav. The `bottom` value
  // is set inline by the screen using insets so it correctly clears the
  // nav's safe-area padding on devices with a home indicator.
  cartBarWrap: {
    position: 'absolute',
    left: 0, right: 0,
    paddingHorizontal: 12,
  },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
    elevation: 8,
    borderWidth: 1, borderColor: Colors.neutralGrayLightest,
  },
  cartBarItems:    { fontSize: 11, color: '#83859C' },
  cartBarTotal:    { fontSize: 18, fontWeight: '700', color: Colors.neutralBlack, marginTop: 2 },
  cartBarMinOrder: { fontSize: 10, color: '#EF4444', fontWeight: '700', marginTop: 2 },
  cartBarBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 12,
    minWidth: 130, alignItems: 'center',
  },
  cartBarBtnDisabled: { backgroundColor: '#C7C8D2' },
  cartBarBtnText:     { color: Colors.neutralWhite, fontWeight: '700', fontSize: 13 },
});

const card = StyleSheet.create({
  outer: {
    width: (W - 44) / 2,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    borderWidth: 1, borderColor: '#EDEEF2',
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12,
    marginBottom: 12,
  },
  outerActive: { borderColor: Colors.primary },

  imgWrap: {
    width: '100%', height: 140,
    borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },

  imgArrow: {
    position: 'absolute', top: '50%', marginTop: -12,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.neutralWhite,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4,
  },
  dots: {
    position: 'absolute', bottom: 6, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  dot:       { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: Colors.neutralWhite, transform: [{ scale: 1.25 }] },
  badge: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: { color: Colors.neutralWhite, fontSize: 10, fontWeight: '700' },

  body: { paddingTop: 10 },
  heading: {
    fontSize: 14, lineHeight: 20, fontWeight: '700',
    color: Colors.neutralBlack, marginBottom: 2,
  },
  desc: {
    fontSize: 11, lineHeight: 16, color: '#83859C',
    minHeight: 32,
  },

  varRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 },
  varChip: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#EDEEF2',
    backgroundColor: Colors.neutralWhite,
  },
  varChipActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  varChipText:       { fontSize: 10, fontWeight: '700', color: Colors.neutralGrayDark },
  varChipTextActive: { color: Colors.neutralWhite },

  footer: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  price:    { fontSize: 13, fontWeight: '700', color: Colors.neutralBlack },
  perWeight:{ fontSize: 9, color: '#83859C', marginTop: 1 },

  qtyRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDEEF2', borderRadius: 6, padding: 2,
  },
  qtyBtn:  { paddingHorizontal: 4, paddingVertical: 2 },
  qtyText: { paddingHorizontal: 8, fontSize: 12, fontWeight: '700', color: Colors.neutralBlack },

  plusBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});

const sb = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: Colors.neutralWhite,
    width: '100%', maxWidth: 500, height: '100%',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  title: {
    flex: 1, fontSize: 22, fontWeight: '700',
    color: Colors.neutralBlack, marginRight: 12,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },

  imgWrap: {
    width: '100%', aspectRatio: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 0,
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  imgArrow: {
    position: 'absolute', top: '50%', marginTop: -18,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.neutralWhite,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
    elevation: 4,
  },
  imgPager: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  imgPagerText: { color: Colors.neutralWhite, fontSize: 11, fontWeight: '600' },

  body: { paddingHorizontal: 20, paddingTop: 16 },
  desc: {
    fontSize: 14, lineHeight: 22,
    color: Colors.neutralGrayDark,
    marginBottom: 16,
  },

  varBlock: { marginTop: 4, marginBottom: 16 },
  varLabel: { fontSize: 13, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 10 },
  varRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  varChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2, borderColor: '#EDEEF2',
    backgroundColor: Colors.neutralWhite,
  },
  varChipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(5,74,134,0.05)' },
  varChipWeight: { fontSize: 13, fontWeight: '700', color: Colors.neutralGrayDark },
  varChipPrice:  { fontSize: 11, color: '#83859C', marginTop: 2 },

  qtyBlock: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16, padding: 14,
    marginTop: 4,
  },
  qtyLabel: { fontSize: 14, fontWeight: '700', color: Colors.neutralGrayDark },
  qtyRow:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyStepBtn: {
    width: 38, height: 38, borderRadius: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: Colors.neutralWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontSize: 18, fontWeight: '700', color: Colors.primary, minWidth: 26, textAlign: 'center' },

  subtotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 18, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  subtotalLabel: { fontSize: 13, color: Colors.neutralGrayDark, fontWeight: '600' },
  subtotalValue: { fontSize: 22, fontWeight: '800', color: Colors.primary },

  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    gap: 10,
    backgroundColor: Colors.neutralWhite,
  },
  closeAction: {
    flex: 1, borderWidth: 2, borderColor: '#EBEBEB',
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: Colors.neutralWhite,
  },
  closeActionText: { color: Colors.neutralGrayDark, fontSize: 14, fontWeight: '700' },
  addAction: {
    flex: 1, backgroundColor: Colors.primary,
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  addActionText: { color: Colors.neutralWhite, fontSize: 14, fontWeight: '700' },
});

const dm = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    backgroundColor: Colors.neutralWhite,
    width: '100%', maxWidth: 400, maxHeight: '90%',
    borderRadius: 24, overflow: 'hidden',
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title:    { fontSize: 22, fontWeight: '700', color: Colors.neutralBlack },
  subtitle: { fontSize: 13, color: Colors.neutralGrayDark, lineHeight: 18, marginBottom: 18 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 6 },
  input: {
    height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: '#EDEEF2',
    paddingHorizontal: 14, fontSize: 14,
    color: Colors.neutralBlack, backgroundColor: Colors.neutralWhite,
  },
  inputError: { borderColor: '#F87171' },
  errorText: { color: '#EF4444', fontSize: 11, marginTop: 4 },

  cityRow: { flexDirection: 'row', gap: 8 },
  cityBtn: {
    flex: 1, paddingVertical: 10,
    borderRadius: 12, borderWidth: 2, borderColor: '#EDEEF2',
    alignItems: 'center', backgroundColor: Colors.neutralWhite,
  },
  cityBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(5,74,134,0.05)' },
  cityBtnText:   { fontSize: 12, fontWeight: '700', color: Colors.neutralGrayDark },
  cityBtnTextActive: { color: Colors.primary },
  deliveryNote:  { fontSize: 10, color: Colors.primary, fontWeight: '700', marginTop: 6 },

  gridRow: { flexDirection: 'row' },

  footer: {
    flexDirection: 'row',
    paddingTop: 14, marginTop: 4,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    gap: 10,
  },
  cancelBtn: {
    flex: 0.4, borderWidth: 2, borderColor: '#EBEBEB',
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  cancelBtnText: { color: Colors.neutralGrayDark, fontWeight: '700', fontSize: 14 },
  continueBtn: {
    flex: 0.6, backgroundColor: Colors.primary,
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: '#C7C8D2' },
  continueBtnText: { color: Colors.neutralWhite, fontWeight: '700', fontSize: 14 },
});

const mo = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16,
  },
  panel: {
    backgroundColor: Colors.neutralWhite,
    width: '100%', maxWidth: 420,
    borderRadius: 24,
    paddingHorizontal: 28, paddingVertical: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFEDD5',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.neutralBlack, marginBottom: 10 },
  body:  {
    fontSize: 14, lineHeight: 20, textAlign: 'center',
    color: Colors.neutralGrayDark, marginBottom: 22,
  },
  btn: {
    width: '100%', backgroundColor: Colors.primary,
    paddingVertical: 13, borderRadius: 12, alignItems: 'center',
  },
  btnText: { color: Colors.neutralWhite, fontSize: 14, fontWeight: '700' },
});

const toast = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', zIndex: 110,
  },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E8F9F1', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
    minWidth: 280,
    shadowColor: '#34C759', shadowOpacity: 0.2, shadowRadius: 8,
    elevation: 4,
  },
  text: { color: Colors.neutralBlack, fontWeight: '700', fontSize: 13 },
});
