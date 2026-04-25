/**
 * DostaSweets — faithful translation of:
 *   web: pages/catering/Sweets.tsx → components/Sweets/SweetsMenu.tsx + SweetsCard.tsx
 *
 * Web SweetsCard structure:
 *   w-full max-w-[306px] border border-[#EDEEF2] (active: border-[#054A86])
 *   rounded-[16px] px-4 pt-4 pb-6 bg-white
 *   Image carousel (with left/right arrows + swipe)
 *   heading text-[20px] font-[700]
 *   description text-[14px] text-[#545563]
 *   Variation chips (weight + price)
 *   Price + qty stepper (− N +) OR [Add to Cart] button
 *
 * Web SweetsMenu structure:
 *   - GET /api/catering/sweets-menu/ → items array with id, name, description, price, image_url, images[], variations[]
 *   - Local cart state (not API cart — pushed to cart API on checkout)
 *   - Checkout → delivery modal → collect address/phone/city → POST /api/vending/cart/ plan_type=SWEETS
 *   - Minimum order AED 100 for non-Dubai cities
 *   - Delivery charge: Dubai = 0, others = AED 40
 *   - Detailed item modal: shows all images + variation selector + qty
 *
 * All logic preserved exactly from web.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, TouchableWithoutFeedback, ActivityIndicator,
  Alert, StyleSheet, Dimensions, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { Minus, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { MotiView } from 'moti';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import Shimmer from '@/components/ui/Shimmer';
import { syncLocalCart } from '@/store/slices/cartSlice';
import { getAuthToken, setSweetsDeliveryInfo } from '@/utils/storage';
import { BASE_URL } from '@/services/api';

const { width: SCREEN_W } = Dimensions.get('window');

const CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

// Types matching web SweetsCard.tsx
interface SweetsItemImage  { id: number; image_url: string; alt_text: string; order: number; }
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

// ── SweetsCard — translation of web SweetsCard.tsx ───────────────────────────
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

  const allImages =
    data.images && data.images.length > 0
      ? data.images.map((img) => img.image_url)
      : [data.imgSrc || 'https://placehold.co/306x200?text=Sweets'];

  const itemInCart = cartItems.find(
    (i) => i.id === data.id && i.selectedVariation?.id === (selectedVariation?.id || 0),
  );

  const currentPrice = selectedVariation
    ? `AED ${parseFloat(selectedVariation.price).toFixed(2)}`
    : data.price;

  return (
    <TouchableOpacity
      style={[styles.sweetsCard, itemInCart && styles.sweetsCardActive]}
      onPress={() => handleCardClick(data, selectedVariation)}
      activeOpacity={0.9}>
      {/* Image carousel */}
      <View style={styles.sweetsCardImgWrap}>
        <Image
          source={{ uri: allImages[imgIndex] }}
          style={styles.sweetsCardImg}
          contentFit="cover"
          transition={200}
        />
        {allImages.length > 1 && (
          <>
            <TouchableOpacity
              style={[styles.imgArrow, styles.imgArrowLeft]}
              onPress={(e) => { e.stopPropagation?.(); setImgIndex(Math.max(0, imgIndex - 1)); }}>
              <ChevronLeft size={16} color={Colors.neutralWhite} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imgArrow, styles.imgArrowRight]}
              onPress={(e) => { e.stopPropagation?.(); setImgIndex(Math.min(allImages.length - 1, imgIndex + 1)); }}>
              <ChevronRight size={16} color={Colors.neutralWhite} />
            </TouchableOpacity>
            <View style={styles.imgDots}>
              {allImages.map((_, i) => (
                <View key={i} style={[styles.imgDot, i === imgIndex && styles.imgDotActive]} />
              ))}
            </View>
          </>
        )}
      </View>

      {/* Card content */}
      <View style={styles.sweetsCardBody}>
        {/* heading text-[20px] font-[700] */}
        <Text style={styles.sweetsCardHeading}>{data.heading}</Text>
        {/* description text-[14px] text-[#545563] */}
        <Text style={styles.sweetsCardDesc} numberOfLines={2}>{data.description}</Text>

        {/* Variations */}
        {data.variations && data.variations.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
            {data.variations.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[
                  styles.variationChip,
                  selectedVariation?.id === v.id && styles.variationChipActive,
                ]}
                onPress={() => setSelectedVariation(v)}>
                <Text style={[styles.variationChipText, selectedVariation?.id === v.id && styles.variationChipTextActive]}>
                  {v.weight}
                </Text>
                <Text style={[styles.variationChipPrice, selectedVariation?.id === v.id && styles.variationChipTextActive]}>
                  AED {parseFloat(v.price).toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Price + stepper or Add button */}
        <View style={styles.sweetsCardFooter}>
          <Text style={styles.sweetsCardPrice}>{currentPrice}</Text>
          {itemInCart ? (
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => handleQuantityChange(data, -1, selectedVariation)}>
                <Minus size={12} color={Colors.neutralBlack} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{itemInCart.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => handleQuantityChange(data, 1, selectedVariation)}>
                <Plus size={12} color={Colors.neutralBlack} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => handleQuantityChange(data, 1, selectedVariation)}>
              <Plus size={14} color={Colors.neutralWhite} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Item Detail Modal ─────────────────────────────────────────────────────────
const ItemDetailModal = ({
  item,
  cartItems,
  onClose,
  onQtyChange,
}: {
  item: SweetsItemType | null;
  cartItems: SelectedSweetsItem[];
  onClose: () => void;
  onQtyChange: (item: SweetsItemType, delta: number, variation?: SweetsItemVariation, absolute?: boolean) => void;
}) => {
  const [selectedVariation, setSelectedVariation] = useState<SweetsItemVariation | undefined>(
    item?.variations?.[0],
  );
  const [imgIndex, setImgIndex] = useState(0);
  const [modalQty, setModalQty] = useState(1);

  useEffect(() => {
    if (!item) return;
    setSelectedVariation(item.variations?.[0]);
    setImgIndex(0);
    const inCart = cartItems.find(
      (c) => c.id === item.id && c.selectedVariation?.id === (item.variations?.[0]?.id || 0),
    );
    setModalQty(inCart?.quantity || 1);
  }, [item?.id]);

  if (!item) return null;

  const allImages =
    item.images && item.images.length > 0
      ? item.images.map((img) => img.image_url)
      : [item.imgSrc || 'https://placehold.co/400x300?text=Sweets'];

  const currentPrice = selectedVariation
    ? `AED ${parseFloat(selectedVariation.price).toFixed(2)}`
    : item.price;

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={modalStyles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={modalStyles.panel}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Handle */}
                <View style={modalStyles.handle} />

                {/* Header */}
                <View style={modalStyles.header}>
                  <Text style={modalStyles.title} numberOfLines={2}>{item.heading}</Text>
                  <TouchableOpacity style={modalStyles.closeBtn} onPress={onClose}>
                    <X size={20} color={Colors.neutralBlack} />
                  </TouchableOpacity>
                </View>

                {/* Image carousel */}
                <View style={modalStyles.imgWrap}>
                  <Image
                    source={{ uri: allImages[imgIndex] }}
                    style={modalStyles.img}
                    contentFit="cover"
                    transition={200}
                  />
                  {allImages.length > 1 && (
                    <>
                      <TouchableOpacity
                        style={[styles.imgArrow, styles.imgArrowLeft]}
                        onPress={() => setImgIndex(Math.max(0, imgIndex - 1))}>
                        <ChevronLeft size={20} color={Colors.neutralWhite} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imgArrow, styles.imgArrowRight]}
                        onPress={() => setImgIndex(Math.min(allImages.length - 1, imgIndex + 1))}>
                        <ChevronRight size={20} color={Colors.neutralWhite} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                <View style={modalStyles.body}>
                  <Text style={modalStyles.desc}>{item.description}</Text>

                  {/* Variations */}
                  {item.variations && item.variations.length > 0 && (
                    <View style={modalStyles.variationsWrap}>
                      <Text style={modalStyles.variationsLabel}>Select Size</Text>
                      {item.variations.map((v) => (
                        <TouchableOpacity
                          key={v.id}
                          style={[
                            modalStyles.variationRow,
                            selectedVariation?.id === v.id && modalStyles.variationRowActive,
                          ]}
                          onPress={() => setSelectedVariation(v)}>
                          <Text style={[modalStyles.variationWeight, selectedVariation?.id === v.id && { color: Colors.primary }]}>
                            {v.weight}
                          </Text>
                          <Text style={[modalStyles.variationPrice, selectedVariation?.id === v.id && { color: Colors.primary }]}>
                            AED {parseFloat(v.price).toFixed(2)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Qty selector */}
                  <View style={modalStyles.qtyWrap}>
                    <Text style={modalStyles.qtyLabel}>Quantity</Text>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => setModalQty(Math.max(1, modalQty - 1))}>
                        <Minus size={14} color={Colors.neutralBlack} />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{modalQty}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => setModalQty(modalQty + 1)}>
                        <Plus size={14} color={Colors.neutralBlack} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={modalStyles.currentPrice}>{currentPrice}</Text>

                  <TouchableOpacity
                    style={modalStyles.addBtn}
                    onPress={() => {
                      onQtyChange(item, modalQty, selectedVariation, true);
                      onClose();
                    }}>
                    <Text style={modalStyles.addBtnText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ── Delivery Modal ────────────────────────────────────────────────────────────
const DeliveryModal = ({
  visible, onClose, onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (address: string, phone: string, city: string) => void;
}) => {
  const [appt,     setAppt]     = useState('');
  const [building, setBuilding] = useState('');
  const [street,   setStreet]   = useState('');
  const [phone,    setPhone]    = useState('');
  const [city,     setCity]     = useState('Dubai');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={deliveryStyles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={deliveryStyles.panel}>
              <Text style={deliveryStyles.title}>Delivery Details</Text>

              {[
                { label: 'Apartment / Villa No.', value: appt,     set: setAppt },
                { label: 'Building Name',          value: building, set: setBuilding },
                { label: 'Street / Area',          value: street,   set: setStreet },
                { label: 'Phone Number',           value: phone,    set: setPhone,    keyboard: 'phone-pad' as any },
              ].map(({ label, value, set, keyboard }) => (
                <View key={label} style={deliveryStyles.fieldWrap}>
                  <Text style={deliveryStyles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={deliveryStyles.input}
                    placeholder={label}
                    placeholderTextColor={Colors.neutralGray}
                    keyboardType={keyboard}
                    value={value}
                    onChangeText={set}
                  />
                </View>
              ))}

              <Text style={[deliveryStyles.fieldLabel, { marginTop: 16 }]}>City</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CITIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[deliveryStyles.cityChip, city === c && deliveryStyles.cityChipActive]}
                    onPress={() => setCity(c)}>
                    <Text style={[deliveryStyles.cityChipText, city === c && deliveryStyles.cityChipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {city !== 'Dubai' && (
                <Text style={deliveryStyles.deliveryNote}>
                  Delivery charge for {city}: AED 40
                </Text>
              )}

              <TouchableOpacity
                style={deliveryStyles.confirmBtn}
                onPress={() => {
                  if (!appt.trim() || !building.trim() || !street.trim() || !phone.trim()) {
                    Alert.alert('Missing fields', 'Please fill in all address fields.');
                    return;
                  }
                  const combinedAddress = `${appt.trim()}, ${building.trim()}, ${street.trim()}`;
                  onConfirm(combinedAddress, phone.trim(), city);
                }}>
                <Text style={deliveryStyles.confirmBtnText}>Confirm & Continue</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function DostaSweets() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const dispatch   = useDispatch();

  const [sweetsData,        setSweetsData]        = useState<SweetsItemType[]>([]);
  const [loading,           setLoading]           = useState(true);
  const [cart,              setCart]              = useState<SelectedSweetsItem[]>([]);
  const [selectedItem,      setSelectedItem]      = useState<SweetsItemType | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [submitting,        setSubmitting]        = useState(false);
  const [selectedCity,      setSelectedCity]      = useState('Dubai');

  const deliveryCharge = selectedCity === 'Dubai' ? 0 : 40;
  const subtotal = cart.reduce((sum, item) => {
    const priceNum = parseFloat((item.price || '0').replace('AED ', ''));
    return sum + priceNum * item.quantity;
  }, 0);
  const totalPrice = subtotal + (cart.length > 0 ? deliveryCharge : 0);

  // Fetch sweets menu — exact from web
  useEffect(() => {
    const fetchSweetsMenu = async () => {
      setLoading(true);
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
      } catch { } finally { setLoading(false); }
    };
    fetchSweetsMenu();
  }, []);

  // Sync cart to redux when empty
  useEffect(() => {
    if (cart.length === 0) dispatch(syncLocalCart([]));
  }, [cart.length, dispatch]);

  // handleQuantityChange — identical to web
  const handleQuantityChange = (
    item: SweetsItemType,
    delta: number,
    variation?: SweetsItemVariation,
    absolute?: boolean,
  ) => {
    setCart((prevCart) => {
      const vId   = variation?.id || 0;
      const key   = `${item.id}-${vId}`;
      const idx   = prevCart.findIndex((i) => `${i.id}-${i.selectedVariation?.id || 0}` === key);

      if (idx > -1) {
        const newQ = absolute ? delta : prevCart[idx].quantity + delta;
        if (newQ <= 0) return prevCart.filter((_, i) => i !== idx);
        const updated = [...prevCart];
        updated[idx] = { ...updated[idx], quantity: newQ };
        return updated;
      } else if (delta > 0) {
        const itemPrice = variation ? `AED ${parseFloat(variation.price).toFixed(2)}` : item.price;
        return [
          ...prevCart,
          { ...item, price: itemPrice, quantity: delta, selectedVariation: variation },
        ];
      }
      return prevCart;
    });
  };

  // submitDeliveryInfo — identical to web
  const submitDeliveryInfo = async (address: string, phone: string, city: string) => {
    if (city !== 'Dubai' && subtotal < 100) {
      Alert.alert(
        'Minimum Order',
        `Delivery to ${city} requires a minimum order of AED 100. Current: AED ${subtotal.toFixed(2)}.`,
      );
      return;
    }
    await setSweetsDeliveryInfo({ address, phone, city });
    setShowDeliveryModal(false);
    setSelectedCity(city);
    await handleConfirmOrder(address, phone, city);
  };

  // handleConfirmOrder — identical to web SweetsMenu.handleConfirmOrder
  const handleConfirmOrder = async (address?: string, phone?: string, city?: string) => {
    if (cart.length === 0) return;
    setSubmitting(true);
    const token = await getAuthToken();
    if (!token) { navigation.navigate('SignIn'); return; }

    try {
      // Get location from selectedLocation storage (identical to web)
      const { getSelectedLocation } = await import('@/utils/storage');
      const loc = await getSelectedLocation();
      const locId = Number(loc?.location?.id) || 1;
      const activeCity = city || selectedCity;
      const activeDeliveryCharge = activeCity === 'Dubai' ? 0 : 40;

      const items = cart.map((item) => ({
        id:               item.id,
        menu_item_id:     item.id,
        variation_id:     item.selectedVariation?.id || null,
        quantity:         item.quantity || 1,
        day_of_week:      null,
        week_number:      null,
        vending_good_uuid:null,
        plan_type:        'SWEETS',
        plan_subtype:     'SWEETS',        // web uses "SWEETS" not "NONE"
        menu_item: {
          id:          item.id,
          name:        item.selectedVariation
            ? `${item.heading} (${item.selectedVariation.weight})`
            : item.heading,
          price:       (item.price || '0').replace('AED ', ''),
          image_url:   item.imgSrc,
          description: item.description || '',
        },
      }));

      const payload: any = {
        location_id:    locId,
        plan_type:      'SWEETS',
        plan_subtype:   'SWEETS',          // web uses "SWEETS" not "NONE"
        pickup_type:    'TODAY',           // web includes this
        pickup_date:    new Date().toISOString().split('T')[0],
        pickup_slot_id: null,
        city:           activeCity,
        delivery_charge:activeDeliveryCharge,
        current_step:   4,                 // web sets current_step: 4
        items,
      };
      if (address && phone) {
        payload.delivery_address = address;
        payload.customer_phone   = phone;
      }

      await axios.post(`${BASE_URL}/api/vending/cart/`, payload, {
        headers: { Authorization: `Token ${token}` },
      });

      // Sync to Redux
      const reduxItems = cart.map((item, i) => ({
        id:             i + 1,
        menuItemId:     item.id,
        name:           item.selectedVariation?.weight || item.heading,
        notes:          'Dosta Sweets',
        pickupLocation: 'Delivery',
        imageUrl:       item.imgSrc || '',
        quantity:       item.quantity,
        price:          parseFloat((item.price || '0').replace('AED ', '')),
        dayOfWeek:      null,
        weekNumber:     null,
        vendingGoodUuid:null,
        planType:       'SWEETS',
        planSubtype:    'SWEETS',
        variationId:    item.selectedVariation?.id || null,
      }));
      dispatch(syncLocalCart(reduxItems));
      navigation.navigate('Cart');
    } catch {
      Alert.alert('Error', 'Failed to add items to cart. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header />

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Dosta Sweets</Text>
        <Text style={styles.sectionSubtitle}>
          Premium sweets delivered to your door within 24 hours.
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: 16 }}><Shimmer /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}>
          {sweetsData.map((data) => (
            <SweetsCard
              key={data.id}
              data={data}
              cartItems={cart}
              handleCardClick={(item, variation) => setSelectedItem(item)}
              handleQuantityChange={handleQuantityChange}
            />
          ))}
        </ScrollView>
      )}

      {/* Cart summary bar (identical to web bottom strip) */}
      {cart.length > 0 && (
        <View style={[styles.cartBar, { paddingBottom: insets.bottom || 16 }]}>
          <View>
            <Text style={styles.cartBarItems}>{totalItems} items</Text>
            <Text style={styles.cartBarTotal}>
              AED {totalPrice.toFixed(2)}
              {deliveryCharge > 0 ? ` (+AED ${deliveryCharge} delivery)` : ' (Free delivery)'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cartBarBtn}
            onPress={() => setShowDeliveryModal(true)}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Text style={styles.cartBarBtnText}>Checkout</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <MobileFooterNav />
      <Footer />

      {/* Item detail modal */}
      <ItemDetailModal
        item={selectedItem}
        cartItems={cart}
        onClose={() => setSelectedItem(null)}
        onQtyChange={handleQuantityChange}
      />

      {/* Delivery info modal */}
      <DeliveryModal
        visible={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        onConfirm={submitDeliveryInfo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFD' },
  sectionHeader: {
    backgroundColor: Colors.neutralDark,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  sectionTitle: { fontSize: 28, fontWeight: '800', color: Colors.neutralWhite },
  sectionSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 20 },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16, gap: 12, paddingBottom: 0,
  },
  // SweetsCard — max-w-[306px]
  sweetsCard: {
    width: (SCREEN_W - 44) / 2,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    overflow: 'hidden',
    marginBottom: 4,
  },
  sweetsCardActive: { borderColor: Colors.primary },
  sweetsCardImgWrap: {
    width: '90%',
    height: 160,
    position: 'relative',
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  sweetsCardImg: { width: '100%', height: '100%' },
  imgArrow: {
    position: 'absolute', top: '50%', marginTop: -16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  imgArrowLeft:  { left: 8 },
  imgArrowRight: { right: 8 },
  imgDots: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 4,
  },
  imgDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  imgDotActive: { backgroundColor: Colors.neutralWhite },
  sweetsCardBody: { paddingHorizontal: 12, paddingBottom: 16 },
  sweetsCardHeading: { fontSize: 16, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 4 },
  sweetsCardDesc: { fontSize: 12, color: Colors.neutralGrayDark, lineHeight: 16 },
  variationChip: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1,
    borderColor: Colors.neutralGrayLight,
    marginRight: 6, alignItems: 'center',
    backgroundColor: Colors.neutralWhite,
  },
  variationChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  variationChipText: { fontSize: 11, fontWeight: '600', color: Colors.neutralBlack },
  variationChipPrice: { fontSize: 10, color: Colors.neutralGray, marginTop: 1 },
  variationChipTextActive: { color: Colors.primary },
  sweetsCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sweetsCardPrice: { fontSize: 14, fontWeight: '700', color: Colors.neutralBlack },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 24, height: 24, borderRadius: 4, backgroundColor: Colors.neutralGrayLightest, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 14, fontWeight: '600', color: Colors.neutralBlack, minWidth: 20, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: Colors.neutralWhite, fontSize: 12, fontWeight: '700' },
  // Cart bar
  cartBar: {
    backgroundColor: Colors.neutralDark,
    paddingHorizontal: 20,
    paddingTop: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cartBarItems: { color: Colors.neutralWhite, fontWeight: '700', fontSize: 14 },
  cartBarTotal: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  cartBarBtn: {
    backgroundColor: Colors.neutralWhite,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12,
  },
  cartBarBtnText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  panel: {
    backgroundColor: Colors.neutralWhite,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4, backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.neutralGrayLightest,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.neutralBlack, flex: 1, marginRight: 12 },
  closeBtn: { padding: 8, borderRadius: 999, backgroundColor: '#F3F4F6' },
  imgWrap: { width: '100%', height: 240, position: 'relative' },
  img: { width: '100%', height: '100%' },
  body: { padding: 20 },
  desc: { fontSize: 14, color: Colors.neutralGrayDark, lineHeight: 20, marginBottom: 16 },
  variationsWrap: { marginBottom: 16 },
  variationsLabel: { fontSize: 14, fontWeight: '600', color: Colors.neutralBlack, marginBottom: 8 },
  variationRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 12, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.neutralGrayLightest, marginBottom: 8,
    backgroundColor: Colors.neutralWhite,
  },
  variationRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  variationWeight: { fontSize: 14, fontWeight: '600', color: Colors.neutralBlack },
  variationPrice: { fontSize: 14, fontWeight: '700', color: Colors.neutralBlack },
  qtyWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  qtyLabel: { fontSize: 14, fontWeight: '600', color: Colors.neutralBlack },
  currentPrice: { fontSize: 20, fontWeight: '700', color: Colors.primary, marginBottom: 16 },
  addBtn: {
    backgroundColor: Colors.primary, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  addBtnText: { color: Colors.neutralWhite, fontWeight: '700', fontSize: 16 },
});

const deliveryStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  panel: {
    backgroundColor: Colors.neutralWhite,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 20 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.neutralGrayDark, marginBottom: 4 },
  input: {
    height: 44, borderWidth: 1, borderColor: Colors.neutralGrayLight,
    borderRadius: 12, paddingHorizontal: 12, fontSize: 14,
    color: Colors.neutralBlack, backgroundColor: Colors.background,
  },
  cityChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    borderColor: Colors.neutralGrayLight,
    marginRight: 8, backgroundColor: Colors.neutralWhite,
  },
  cityChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  cityChipText: { fontSize: 13, color: Colors.neutralBlack },
  cityChipTextActive: { color: Colors.primary, fontWeight: '600' },
  deliveryNote: { fontSize: 13, color: Colors.neutralGrayDark, marginBottom: 16 },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnText: { color: Colors.neutralWhite, fontWeight: '700', fontSize: 16 },
});
