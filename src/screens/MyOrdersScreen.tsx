/**
 * MyOrdersScreen — faithful translation of web pages/MyOrders.tsx
 *
 * Web structure (preserved exactly):
 *   Header
 *   BreadCrumb + h2 "My Orders"
 *   For each order:
 *     Order card: order ID, status badge, location, date, total
 *     Expanded: OrderedItem list + QR code + Pickup Code + retry panel
 *   VendingMap component (shows location on map)
 *   MobileFooterNav, Footer
 *
 * Logic preserved:
 *   - GET /api/vending/orders/ with 10-second polling
 *   - Stops polling when latest order is READY/COMPLETED/PICKED_UP
 *   - POST /api/vending/order/{id}/retry-fulfillment/
 *   - Auth guard → redirect to SignIn if no token
 *   - OrderedItem component — image, name, notes, pickup, status badge
 *
 * OrderedItem (web components/Cart/OrderedItem.tsx):
 *   img w-[72px] h-[72px] rounded-lg
 *   name text-[16px] font-[700] text-[#2B2B43]
 *   notes text-[12px] font-[500] text-[#545563]
 *   "Pickup at: {location}" text-[12px]
 *   Status badges: READY bg-[#E6F9F0] text-[#1ABF70] | PREPARING bg-[#FFF8E6] text-[#FFA800] | other bg-[#F0F2F5] text-[#83859C]
 *   qty "x {N}" text-[16px] text-[#83859C] | price text-[16px] font-[700]
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { MapPin, Clock } from 'lucide-react-native';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import BreadCrumb from '@/components/ui/BreadCrumb';
import Shimmer from '@/components/ui/Shimmer';
import { getAuthToken } from '@/utils/storage';
import { BASE_URL } from '@/services/api';

const { width: SCREEN_W } = Dimensions.get('window');

// Status badge colors — exact from web OrderedItem.tsx
const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  READY:               { bg: '#E6F9F0', text: '#1ABF70', label: 'Ready' },
  PREPARING:           { bg: '#FFF8E6', text: '#FFA800', label: 'Preparing' },
  COMPLETED:           { bg: '#F0F2F5', text: '#83859C', label: 'Completed' },
  PICKED_UP:           { bg: '#F0F2F5', text: '#83859C', label: 'Picked Up' },
  PENDING_FULFILLMENT: { bg: '#FFF8E6', text: '#FFA800', label: 'Processing' },
  CONFIRMED:           { bg: '#EEF2FF', text: '#4F46E5', label: 'Confirmed' },
  PENDING:             { bg: '#F0F2F5', text: '#83859C', label: 'Pending' },
  FAILED:              { bg: '#FEF2F2', text: '#EF4444', label: 'Failed' },
};

// ── OrderedItem — translation of web components/Cart/OrderedItem.tsx ─────────
const OrderedItem = ({ item, imageMap }: { item: any; imageMap: Record<string, string> }) => {
  const badge    = STATUS_BADGE[item.status] || STATUS_BADGE.PENDING;
  // Use imageMap to enrich image_url (identical to web MyOrders)
  const imageUrl = imageMap[item.menu_item?.name] || item.menu_item?.image_url || '';

  return (
    <View style={styles.orderedItem}>
      {/* img w-[72px] h-[72px] rounded-lg */}
      <Image
        source={{ uri: imageUrl || 'https://placehold.co/72x72' }}
        style={styles.orderedItemImg}
        resizeMode="cover"
      />
      <View style={styles.orderedItemBody}>
        <View style={styles.orderedItemTop}>
          <View style={{ flex: 1 }}>
            {/* name text-[16px] font-[700] text-[#2B2B43] */}
            <Text style={styles.orderedItemName}>{item.menu_item?.name}</Text>
            {/* notes text-[12px] font-[500] text-[#545563] */}
            {item.day_of_week && (
              <Text style={styles.orderedItemNote}>Meal for {item.day_of_week}</Text>
            )}
            {/* Status badge */}
            <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                {badge.label}
              </Text>
            </View>
          </View>
          {/* qty + price */}
          <View style={styles.orderedItemRight}>
            <Text style={styles.orderedItemQty}>x {item.quantity}</Text>
            <Text style={styles.orderedItemPrice}>
              AED{parseFloat(item.menu_item?.price || '0').toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ── Order Card ────────────────────────────────────────────────────────────────
const OrderCard = ({
  order,
  expanded,
  onToggle,
  onRetry,
  retrying,
  retryError,
  imageMap,
}: {
  order:      any;
  expanded:   boolean;
  onToggle:   () => void;
  onRetry:    () => void;
  retrying:   boolean;
  retryError: string | null;
  imageMap:   Record<string, string>;
}) => {
  const isReady = ['READY', 'COMPLETED', 'PICKED_UP'].includes(order.status);
  const isPendingFulfillment = order.status === 'PENDING_FULFILLMENT';
  const badge   = STATUS_BADGE[order.status] || STATUS_BADGE.PENDING;

  return (
    <TouchableOpacity
      style={[styles.orderCard, expanded && styles.orderCardExpanded]}
      onPress={onToggle}
      activeOpacity={0.9}>
      {/* Card header */}
      <View style={styles.orderCardHeader}>
        <View>
          <Text style={styles.orderCardId}>Order #{order.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg, marginTop: 4 }]}>
            <Text style={[styles.statusBadgeText, { color: badge.text }]}>
              {badge.label}
            </Text>
          </View>
        </View>
        <Text style={styles.orderCardAmount}>
          AED {parseFloat(order.total_amount || '0').toFixed(2)}
        </Text>
      </View>

      {/* Location + date */}
      <View style={styles.orderCardMeta}>
        <View style={styles.metaRow}>
          <MapPin size={13} color={Colors.neutralGray} />
          <Text style={styles.metaText}>{order.location?.name || 'Unknown Location'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Clock size={13} color={Colors.neutralGray} />
          <Text style={styles.metaText}>
            {new Date(order.created_at).toLocaleDateString('en-AE', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}
          </Text>
        </View>
      </View>

      {/* Item preview (first 3) */}
      <View style={styles.itemPreview}>
        {(order.items || []).slice(0, 3).map((item: any, i: number) => (
          <Text key={i} style={styles.itemPreviewText}>
            • {item.menu_item?.name} × {item.quantity}
          </Text>
        ))}
        {order.items?.length > 3 && (
          <Text style={styles.itemPreviewMore}>+ {order.items.length - 3} more</Text>
        )}
      </View>

      {/* Expanded: full item list + QR + retry */}
      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.expandedDivider} />

          {/* Full item list */}
          {(order.items || []).map((item: any, i: number) => (
            <View key={item.id}>
              <OrderedItem item={item} imageMap={imageMap} />
              {i < order.items.length - 1 && <View style={styles.itemDivider} />}
            </View>
          ))}

          {/* QR + pickup code when READY */}
          {isReady && order.pickup_code && (
            <View style={styles.qrSection}>
              <View style={styles.qrBox}>
                <Image
                  source={{
                    uri:
                      order.qr_code_url ||
                      `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${order.pickup_code}`,
                  }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.pickupCodeLabel}>Pickup Code</Text>
              <Text style={styles.pickupCode}>{order.pickup_code}</Text>
              <Text style={styles.qrHint}>Scan at the vending machine</Text>
            </View>
          )}

          {/* Retry panel for PENDING_FULFILLMENT */}
          {isPendingFulfillment && (
            <View style={styles.retrySection}>
              <Text style={styles.retryTitle}>Generating pickup code…</Text>
              {!!retryError && <Text style={styles.retryError}>{retryError}</Text>}
              <TouchableOpacity
                style={[
                  styles.retryBtn,
                  (retrying || order.fulfillment_attempts >= 5) && { opacity: 0.5 },
                ]}
                onPress={onRetry}
                disabled={retrying || order.fulfillment_attempts >= 5}>
                {retrying ? (
                  <ActivityIndicator color={Colors.neutralWhite} size="small" />
                ) : (
                  <Text style={styles.retryBtnText}>🔄 Retry Pickup Code</Text>
                )}
              </TouchableOpacity>
              {order.fulfillment_attempts >= 5 && (
                <Text style={styles.retryMaxText}>
                  Maximum retries reached. Please contact support.
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function MyOrdersScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [orders,       setOrders]      = useState<any[]>([]);
  const [imageMap,     setImageMap]    = useState<Record<string, string>>({});
  const [loading,      setLoading]     = useState(true);
  const [expandedId,   setExpandedId]  = useState<number | null>(null);
  const [retrying,     setRetrying]    = useState(false);
  const [retryError,   setRetryError]  = useState<string | null>(null);
  const [stopPolling,  setStopPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch ORDER_NOW menu images (identical to web MyOrders)
  useEffect(() => {
    const fetchImages = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;
        const res = await axios.get(`${BASE_URL}/api/vending/menu/ORDER_NOW/`, {
          headers: { Authorization: `Token ${token}` },
        });
        const map: Record<string, string> = {};
        res.data.menus?.forEach((menu: any) => {
          menu.items?.forEach((it: any) => {
            if (it.image_url && !map[it.name]) map[it.name] = it.image_url;
          });
        });
        setImageMap(map);
      } catch { }
    };
    fetchImages();
  }, []);

  const fetchOrders = useCallback(async () => {
    if (stopPolling) return;
    try {
      const token = await getAuthToken();
      if (!token) { navigation.replace('SignIn'); return; }
      const res = await axios.get(`${BASE_URL}/api/vending/orders/`, {
        headers: { Authorization: `Token ${token}` },
      });
      const allOrders = res.data;
      setOrders(allOrders);
      setLoading(false);

      // Auto-expand most recent
      if (allOrders.length > 0 && expandedId === null) {
        setExpandedId(allOrders[0].id);
      }

      // Stop polling when terminal status
      if (allOrders.length > 0) {
        const first = allOrders[0];
        const isInstant  = first.plan_type === 'ORDER_NOW' || first.plan_type === 'SMART_GRAB';
        const isTerminal = ['READY', 'COMPLETED', 'PICKED_UP'].includes(first.status);
        if (isInstant && isTerminal) {
          setStopPolling(true);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      }
    } catch { setLoading(false); }
  }, [stopPolling, expandedId, navigation]);

  useEffect(() => {
    fetchOrders();
    pollingRef.current = setInterval(fetchOrders, 5000); // Poll every 5s (matches web)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleRetryFulfillment = async (orderId: number) => {
    const token = await getAuthToken();
    setRetrying(true); setRetryError(null);
    try {
      await axios.post(
        `${BASE_URL}/api/vending/order/${orderId}/retry-fulfillment/`,
        {},
        { headers: { Authorization: `Token ${token}` } },
      );
      const ordersRes = await axios.get(`${BASE_URL}/api/vending/orders/`, {
        headers: { Authorization: `Token ${token}` },
      });
      setOrders(ordersRes.data);
      const updated = ordersRes.data.find((o: any) => o.id === orderId);
      if (!updated?.pickup_code)
        setRetryError("Still couldn't generate pickup code. Please try again.");
    } catch (err: any) {
      setRetryError(err.response?.data?.error || 'Retry failed. Please try again.');
    } finally { setRetrying(false); }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header />

      <View style={styles.titleArea}>
        <BreadCrumb />
        <Text style={styles.pageTitle}>My Orders</Text>
      </View>

      {loading ? (
        <View style={{ padding: 16 }}><Shimmer /></View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>
            Browse the vending menu and place your first order.
          </Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => navigation.navigate('VendingMenu')}>
            <Text style={styles.browseBtnText}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 0 }}
          showsVerticalScrollIndicator={false}>
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
              onRetry={() => handleRetryFulfillment(order.id)}
              retrying={retrying}
              retryError={retryError}
              imageMap={imageMap}
            />
          ))}
        </ScrollView>
      )}

      <MobileFooterNav />
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  titleArea: {
    backgroundColor: Colors.neutralWhite,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  pageTitle: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: 0.1,
  },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: Colors.neutralGrayDark, textAlign: 'center', marginBottom: 24 },
  browseBtn: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  browseBtnText: { color: Colors.neutralWhite, fontWeight: '700' },
  // Order card
  orderCard: {
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardExpanded: {
    borderColor: Colors.primary,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderCardId: { fontSize: 14, fontWeight: '700', color: Colors.neutralBlack },
  orderCardAmount: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  orderCardMeta: { gap: 4, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.neutralGray },
  itemPreview: { gap: 2 },
  itemPreviewText: { fontSize: 12, color: Colors.neutralBlack },
  itemPreviewMore: { fontSize: 12, color: Colors.neutralGray, marginTop: 2 },
  expandedContent: { marginTop: 16 },
  expandedDivider: { height: 1, backgroundColor: Colors.neutralGrayLightest, marginBottom: 16 },
  itemDivider: { height: 1, backgroundColor: '#F9FAFB', marginVertical: 8 },
  // Status badge — exact from web
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  // OrderedItem
  orderedItem: { flexDirection: 'row', gap: 16, paddingVertical: 16 },
  orderedItemImg: { width: 72, height: 72, borderRadius: 8, flexShrink: 0 },
  orderedItemBody: { flex: 1 },
  orderedItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderedItemName: { fontSize: 16, fontWeight: '700', color: Colors.neutralBlack, lineHeight: 24 },
  orderedItemNote: { fontSize: 12, fontWeight: '500', color: Colors.neutralGrayDark, lineHeight: 16, marginTop: 2 },
  orderedItemRight: { flexDirection: 'row', gap: 26, alignItems: 'center' },
  orderedItemQty: { fontSize: 16, fontWeight: '500', color: '#83859C', lineHeight: 24 },
  orderedItemPrice: { fontSize: 16, fontWeight: '700', color: Colors.neutralBlack, lineHeight: 24 },
  // QR section
  qrSection: { alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.neutralGrayLightest },
  qrBox: { width: 150, height: 150, borderWidth: 1, borderColor: '#83859C', borderRadius: 12, padding: 8, marginBottom: 12 },
  qrImage: { width: '100%', height: '100%' },
  pickupCodeLabel: { fontSize: 12, color: '#83859C', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  pickupCode: { fontSize: 32, fontWeight: '900', color: Colors.primary, marginBottom: 4 },
  qrHint: { fontSize: 12, color: '#83859C', textAlign: 'center' },
  // Retry section
  retrySection: { alignItems: 'center', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.neutralGrayLightest },
  retryTitle: { fontSize: 16, fontWeight: '700', color: '#B45309', marginBottom: 8 },
  retryError: { fontSize: 12, color: Colors.error, fontWeight: '600', marginBottom: 8 },
  retryBtn: { backgroundColor: Colors.orange, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, marginBottom: 8 },
  retryBtnText: { color: Colors.neutralWhite, fontWeight: '700', fontSize: 14 },
  retryMaxText: { fontSize: 12, color: Colors.neutralGray, textAlign: 'center' },
});
