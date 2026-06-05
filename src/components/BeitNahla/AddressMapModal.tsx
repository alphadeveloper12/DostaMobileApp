/**
 * AddressMapModal — faithful translation of web
 * components/BeitNahla/AddressMapModal.tsx
 *
 * Web used Leaflet + OpenStreetMap; here we use react-native-maps (Google,
 * the same provider VendingHomeScreen uses) plus expo-location for the
 * "Get my current location" button. Everything else is preserved:
 *
 *   - Name + phone (05XXXXXXXX) inputs
 *   - Tap the map OR use current location to drop a draggable pin
 *   - Reverse geocode (pin → address) via Nominatim (free, no key)
 *   - POST /api/catering/beit-nahla/calculate-delivery/ on every pin move
 *   - Building / Street / Appt fields
 *   - Working-hours banner (open/closed) + distance/charges breakdown
 *   - Submit gated on: phone valid, address fields filled, deliverable,
 *     open now, and a resolved address.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { MapView, Marker, PROVIDER_GOOGLE, MapsAvailable, MapUnavailable } from '@/utils/maps';
import { MotiView } from 'moti';
import { X, MapPin, Locate, Clock } from 'lucide-react-native';
import axios from 'axios';
import { Colors } from '@/utils/colors';
import { BASE_URL } from '@/services/api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface DeliveryResult {
  distance_km: number;
  deliverable: boolean;
  service_charge: number;
  delivery_charge: number;
  total_extra: number;
  tier_label: string | null;
  used_road_distance: boolean;
  max_deliverable_km: number;
  is_open_now?: boolean;
  current_time?: string;
  opening_time?: string;
  closing_time?: string;
  message?: string;
}

export interface AddressData {
  name: string;
  phone: string;
  building: string;
  street: string;
  appt: string;
  latitude: number;
  longitude: number;
  address: string;
  delivery: DeliveryResult;
}

interface AddressMapModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AddressData) => void;
  defaultLat?: number;
  defaultLng?: number;
  openingTime?: string;
  closingTime?: string;
}

// "13:00" -> "1:00 PM". Returns "" for blank/invalid input.
const formatTime = (hhmm?: string) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${(m || 0).toString().padStart(2, '0')} ${period}`;
};

export default function AddressMapModal({
  open,
  onClose,
  onSubmit,
  defaultLat = 25.2048,
  defaultLng = 55.2708,
  openingTime,
  closingTime,
}: AddressMapModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [building, setBuilding] = useState('');
  const [street, setStreet] = useState('');
  const [appt, setAppt] = useState('');
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<any>(null);

  // Reset modal state whenever it opens.
  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setBuilding('');
      setStreet('');
      setAppt('');
      setMarker(null);
      setAddress('');
      setDelivery(null);
      setCalcError(null);
      setLocateError(null);
      setLocating(false);
    }
  }, [open]);

  // Reverse geocode (pin -> address) via Nominatim. Free, no API key.
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);

    // Tentative coord fallback so the field is never blank while we look up.
    setAddress(`Pin location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);

    reverseDebounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get('https://nominatim.openstreetmap.org/reverse', {
          params: {
            lat,
            lon: lng,
            format: 'json',
            zoom: 18,
            addressdetails: 1,
            'accept-language': 'en',
          },
        });
        if (res.data && res.data.display_name) {
          setAddress(res.data.display_name);
        }
      } catch {
        // Keep the coord fallback.
      }
    }, 300);
  }, []);

  // Recalculate delivery (and reverse-geocode address) whenever the pin moves.
  useEffect(() => {
    if (!open || !marker) return;
    let cancelled = false;
    const run = async () => {
      setCalculating(true);
      setCalcError(null);
      setDelivery(null);
      try {
        const res = await axios.post(
          `${BASE_URL}/api/catering/beit-nahla/calculate-delivery/`,
          { user_latitude: marker.lat, user_longitude: marker.lng },
        );
        if (!cancelled) setDelivery(res.data);
      } catch {
        if (!cancelled) setCalcError('Could not calculate distance. Try again.');
      } finally {
        if (!cancelled) setCalculating(false);
      }
    };
    run();
    reverseGeocode(marker.lat, marker.lng);
    return () => {
      cancelled = true;
    };
  }, [marker, open, reverseGeocode]);

  // Animate the map to the pin every time it changes.
  useEffect(() => {
    if (!marker) return;
    mapRef.current?.animateToRegion(
      {
        latitude: marker.lat,
        longitude: marker.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      600,
    );
  }, [marker]);

  const handleGetLocation = async () => {
    setLocateError(null);
    setLocating(true);
    try {
      // expo-location is loaded lazily so a dev build without the native
      // module degrades gracefully to "drop a pin on the map".
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocateError(
          'Location is blocked for this app. Enable it in Settings, or drop a pin on the map instead.',
        );
        setLocating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setMarker({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocateError(null);
    } catch {
      setLocateError("Couldn't get your location. Drop a pin on the map instead.");
    } finally {
      setLocating(false);
    }
  };

  const phoneValid = phone.startsWith('05') && phone.length === 10;
  const isOpenNow = delivery?.is_open_now !== false;
  const customAddressValid =
    name.trim().length > 0 &&
    building.trim().length > 0 &&
    street.trim().length > 0 &&
    appt.trim().length > 0;
  const canSubmit =
    phoneValid &&
    customAddressValid &&
    marker !== null &&
    !calculating &&
    delivery !== null &&
    delivery.deliverable &&
    isOpenNow &&
    address.trim().length > 3;

  const effectiveOpening = delivery?.opening_time || openingTime;
  const effectiveClosing = delivery?.closing_time || closingTime;

  const handleSubmit = () => {
    if (!canSubmit || !delivery || !marker) return;
    onSubmit({
      name: name.trim(),
      phone,
      building: building.trim(),
      street: street.trim(),
      appt: appt.trim(),
      latitude: marker.lat,
      longitude: marker.lng,
      address: address.trim(),
      delivery,
    });
  };

  const submitLabel = !isOpenNow
    ? "Closed — can't order now"
    : delivery && !delivery.deliverable
    ? 'Out of delivery range'
    : !marker
    ? 'Set a location first'
    : 'Continue to Cart';

  const initialRegion = useMemo(
    () => ({
      latitude: defaultLat,
      longitude: defaultLng,
      latitudeDelta: 0.4,
      longitudeDelta: 0.4,
    }),
    [defaultLat, defaultLng],
  );

  const phoneError =
    phone.length > 0 && (phone.length < 10 || !phone.startsWith('05'));

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <MotiView
          from={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Delivery Details</Text>
              <Text style={styles.subtitle}>
                Use your current location, then fine-tune by dragging the pin.
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={Colors.neutralGray} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Working hours banner */}
            {(effectiveOpening || effectiveClosing) && (
              <View style={[styles.hoursBanner, isOpenNow ? styles.hoursOpen : styles.hoursClosed]}>
                <Clock size={20} color={isOpenNow ? '#059669' : Colors.secondary} />
                <View style={styles.hoursTextWrap}>
                  <Text style={[styles.hoursTitle, { color: isOpenNow ? '#047857' : '#B91C1C' }]}>
                    {isOpenNow ? 'Open now' : 'Currently closed'}
                  </Text>
                  <Text style={styles.hoursSub}>
                    Working hours: {formatTime(effectiveOpening)} – {formatTime(effectiveClosing)}
                    {delivery?.current_time
                      ? `  · now ${formatTime(delivery.current_time)}`
                      : ''}
                  </Text>
                </View>
              </View>
            )}

            {/* Full Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor={Colors.neutralGray}
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Phone */}
            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, phoneError && styles.inputError]}
                placeholder="05X XXX XXXX"
                placeholderTextColor={Colors.neutralGray}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, '').slice(0, 10))}
              />
              {phone.length > 0 && !phone.startsWith('05') && (
                <Text style={styles.errorText}>Number must start with 05</Text>
              )}
            </View>

            {/* Get current location */}
            <View style={styles.field}>
              <TouchableOpacity
                style={[styles.locateBtn, locating && styles.locateBtnDisabled]}
                onPress={handleGetLocation}
                disabled={locating}
                activeOpacity={0.85}>
                {locating ? (
                  <>
                    <ActivityIndicator size="small" color={Colors.neutralGray} />
                    <Text style={styles.locateBtnTextDisabled}>Getting your location...</Text>
                  </>
                ) : (
                  <>
                    <Locate size={20} color={Colors.neutralWhite} />
                    <Text style={styles.locateBtnText}>Get my current location</Text>
                  </>
                )}
              </TouchableOpacity>
              {!!locateError && <Text style={styles.errorText}>{locateError}</Text>}
              <Text style={styles.hint}>
                Once placed, drag the pin to fine-tune the exact delivery spot.
              </Text>
            </View>

            {/* Map — falls back to a placeholder in Expo Go (no native map). */}
            {MapsAvailable ? (
              <View style={styles.mapWrap}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={initialRegion}
                  toolbarEnabled={false}
                  onPress={(e: any) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setMarker({ lat: latitude, lng: longitude });
                    setLocateError(null);
                  }}>
                  {marker && (
                    <Marker
                      coordinate={{ latitude: marker.lat, longitude: marker.lng }}
                      draggable
                      onDragEnd={(e: any) => {
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        setMarker({ lat: latitude, lng: longitude });
                      }}
                      pinColor={Colors.primary}
                    />
                  )}
                </MapView>
                <View style={styles.mapHint} pointerEvents="none">
                  <MapPin size={12} color={Colors.primary} />
                  <Text style={styles.mapHintText}>
                    {marker ? 'Drag the pin to adjust' : 'Tap the map or use current location'}
                  </Text>
                </View>
              </View>
            ) : (
              <MapUnavailable
                height={200}
                note="The delivery map needs a development build. Use “Get my current location” to set your pin, or run a dev build to drop it manually."
              />
            )}

            {/* Address (read-only) */}
            <View style={styles.field}>
              <Text style={styles.label}>Delivery Address</Text>
              <TextInput
                style={[styles.input, styles.addressInput]}
                value={address}
                editable={false}
                multiline
                placeholder="Tap a location on the map or 'Get my current location' to set your address."
                placeholderTextColor={Colors.neutralGray}
              />
              <Text style={styles.hint}>
                Filled automatically from your pin. Move the pin to change.
              </Text>
            </View>

            {/* Custom address fields */}
            <View style={styles.field}>
              <Text style={styles.label}>Building</Text>
              <TextInput
                style={styles.input}
                placeholder="Building Name/Number"
                placeholderTextColor={Colors.neutralGray}
                value={building}
                onChangeText={setBuilding}
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, styles.rowItem]}>
                <Text style={styles.label}>Street</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Street Name"
                  placeholderTextColor={Colors.neutralGray}
                  value={street}
                  onChangeText={setStreet}
                />
              </View>
              <View style={[styles.field, styles.rowItem]}>
                <Text style={styles.label}>Appt</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Appt Number"
                  placeholderTextColor={Colors.neutralGray}
                  value={appt}
                  onChangeText={setAppt}
                />
              </View>
            </View>

            {/* Distance result */}
            <View style={styles.resultBox}>
              {!marker ? (
                <Text style={styles.resultMuted}>
                  Set a location to estimate delivery charges.
                </Text>
              ) : calculating ? (
                <View style={styles.resultCalcRow}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultCalcTitle}>Calculating distance...</Text>
                    <Text style={styles.resultMuted}>
                      Estimating from Dosta to your pin. This is fast — hold on.
                    </Text>
                  </View>
                </View>
              ) : calcError ? (
                <Text style={styles.errorText}>{calcError}</Text>
              ) : delivery ? (
                delivery.deliverable ? (
                  <View style={{ gap: 6 }}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultKey}>Distance</Text>
                      <Text style={styles.resultVal}>
                        {delivery.distance_km} km
                        {!delivery.used_road_distance ? '  (approx)' : ''}
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultKey}>Service charge</Text>
                      <Text style={styles.resultValMed}>
                        AED {delivery.service_charge.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultKey}>Delivery charge</Text>
                      <Text style={styles.resultValMed}>
                        AED {delivery.delivery_charge.toFixed(2)}
                      </Text>
                    </View>
                    <View style={[styles.resultRow, styles.resultTotalRow]}>
                      <Text style={styles.resultTotalKey}>Total extra</Text>
                      <Text style={styles.resultTotalVal}>
                        AED {delivery.total_extra.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.resultError}>
                    {delivery.message ||
                      `Sorry, we do not deliver beyond ${delivery.max_deliverable_km} km. Your pin is ${delivery.distance_km} km away.`}
                  </Text>
                )
              ) : null}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              disabled={!canSubmit}
              onPress={handleSubmit}>
              <Text style={styles.submitBtnText}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 12,
  },
  card: {
    width: '100%',
    maxWidth: 640,
    maxHeight: SCREEN_H * 0.92,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  subtitle: {
    fontSize: 13,
    color: '#83859C',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 999,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 16,
  },
  // Working hours banner
  hoursBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hoursOpen: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  hoursClosed: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  hoursTextWrap: {
    flex: 1,
  },
  hoursTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  hoursSub: {
    fontSize: 11,
    color: Colors.neutralGrayDark,
    marginTop: 1,
  },
  // Fields
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    color: Colors.neutralBlack,
    fontSize: 14,
  },
  inputError: {
    borderColor: '#F87171',
  },
  addressInput: {
    height: 64,
    paddingTop: 12,
    textAlignVertical: 'top',
    backgroundColor: Colors.background,
  },
  errorText: {
    color: Colors.secondary,
    fontSize: 12,
  },
  hint: {
    fontSize: 11,
    color: '#83859C',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  rowItem: {
    flex: 1,
  },
  // Locate button
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  locateBtnDisabled: {
    backgroundColor: Colors.neutralGrayLightest,
  },
  locateBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  locateBtnTextDisabled: {
    color: Colors.neutralGray,
    fontWeight: '700',
    fontSize: 14,
  },
  // Map
  mapWrap: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
  },
  map: {
    width: '100%',
    height: 260,
  },
  mapHint: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mapHintText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
  },
  // Result box
  resultBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    backgroundColor: '#FAFAFD',
    padding: 16,
  },
  resultMuted: {
    color: '#83859C',
    fontSize: 13,
  },
  resultCalcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultCalcTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultKey: {
    fontSize: 14,
    color: Colors.neutralGrayDark,
  },
  resultVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutralBlack,
  },
  resultValMed: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutralBlack,
  },
  resultTotalRow: {
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  resultTotalKey: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutralGrayDark,
  },
  resultTotalVal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  resultError: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  cancelBtn: {
    width: '32%',
    borderWidth: 2,
    borderColor: '#EBEBEB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: Colors.neutralGrayDark,
    fontWeight: '700',
    fontSize: 14,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: Colors.neutralGrayLight,
  },
  submitBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
});
