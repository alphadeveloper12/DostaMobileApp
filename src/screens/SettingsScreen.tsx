/**
 * SettingsScreen — faithful translation of:
 *   web: pages/Settings.tsx → components/settings/SettingsLayout.tsx
 *        components/settings/AccountSettings.tsx
 *        components/settings/AddressSettings.tsx
 *        components/settings/PaymentSettings.tsx
 *        components/settings/SecuritySettings.tsx
 *
 * Web SettingsLayout:
 *   Sidebar with 4 nav items (icons: User, MapPin, CreditCard, Shield)
 *   Each item: icon + label (e.g. "Account") + description (e.g. "Personal information")
 *   Active: bg-[#EAF5FF] border-l-2 border-[#054A86] (via cn() classname)
 *   Content area renders matching component
 *
 * Web AccountSettings:
 *   - GET /api/profile/ → { full_name, company, email, email_notifications }
 *   - PUT /api/profile/ → update
 *   - Notification checkboxes
 *   - Logout button
 *
 * Web AddressSettings:
 *   - GET /api/addresses/ → address list
 *   - POST /api/addresses/ → add new
 *   - country-state-city library for dropdowns
 *
 * Web PaymentSettings:
 *   - GET /api/payment-methods/ → card list { masked_card, expiration, cardholder_name }
 *   - POST /api/payment-methods/ → add new (card_number, expiration, cvc, cardholder_name)
 *
 * Web SecuritySettings:
 *   - 2FA section: phone input + [Turn on] button
 *   - Change password: current / new / confirm inputs
 */

import DeleteIcon   from '@/assets/images/icons/delete.svg';
import RoundTickIcon from '@/assets/images/icons/round_tick.svg';
import VisaIcon      from '@/assets/images/icons/visa.svg';
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { User, MapPin, CreditCard, Shield } from 'lucide-react-native';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { useDispatch } from 'react-redux';
import { Country, State } from 'country-state-city';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import Shimmer from '@/components/ui/Shimmer';
import { getAuthToken, removeAuthToken, removeUser, storage } from '@/utils/storage';
import { clearUser } from '@/store/slices/userSlice';
import { clearCart } from '@/store/slices/cartSlice';
import { BASE_URL } from '@/services/api';

// Sidebar nav items — exact from web SettingsLayout
const NAV_ITEMS = [
  { id: 1, Icon: User,       label: 'Account',        description: 'Personal information' },
  { id: 2, Icon: MapPin,     label: 'Address',         description: 'Shipping addresses' },
  { id: 3, Icon: CreditCard, label: 'Payment method',  description: 'Connected credit cards' },
  { id: 4, Icon: Shield,     label: 'Security',        description: 'Password, 2FA' },
];

// ── AccountSettings (translation of web AccountSettings.tsx) ─────────────────
const AccountSettings = () => {
  const navigation = useNavigation<any>();
  const dispatch   = useDispatch();
  const [profile,       setProfile]       = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [updating,      setUpdating]      = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  useEffect(() => {
    const fetch_ = async () => {
      const token = await getAuthToken();
      if (!token) { navigation.navigate('SignIn'); return; }
      try {
        const res = await fetch(`${BASE_URL}/api/profile/`, {
          headers: { Authorization: `Token ${token}` },
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setProfile(data);
        setNotifications(data.email_notifications || []);
      } catch { navigation.navigate('SignIn'); }
      finally { setLoading(false); }
    };
    fetch_();
  }, []);

  const handleSave = async () => {
    const token = await getAuthToken();
    if (!token || !profile) return;
    setUpdating(true);
    try {
      const res = await fetch(`${BASE_URL}/api/profile/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify({
          full_name:           profile.full_name,
          company:             profile.company,
          email_notifications: notifications,
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      const updated = await res.json();
      setProfile(updated);
      Toast.show({ type: 'success', text1: 'Profile updated successfully!' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to update profile.' });
    } finally { setUpdating(false); }
  };

  const handleLogout = async () => {
    await removeAuthToken();
    await removeUser();
    await storage.removeItem('selectedLocation');
    dispatch(clearUser());
    dispatch(clearCart());
    navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
  };

  if (loading) return <Shimmer />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* h1 "Account" text-[20px] font-[600] */}
      <Text style={settingsStyles.sectionHeading}>Account</Text>

      <View style={settingsStyles.card}>
        {/* h2 "Personal information" */}
        <Text style={settingsStyles.cardTitle}>Personal information</Text>

        {/* grid grid-cols-2 → vertical on mobile */}
        {[
          { label: 'Full name',    key: 'full_name',    placeholder: 'Full name' },
          { label: 'Company',      key: 'company',      placeholder: 'Company' },
          { label: 'Email',        key: 'email',        placeholder: 'Email', editable: false },
          { label: 'Phone number', key: 'phone_number', placeholder: 'Phone number' },
        ].map(({ label, key, placeholder, editable = true }) => (
          <View key={key} style={settingsStyles.field}>
            <Text style={settingsStyles.fieldLabel}>{label}</Text>
            <TextInput
              style={[settingsStyles.fieldInput, !editable && { backgroundColor: Colors.background, color: Colors.neutralGray }]}
              placeholder={placeholder}
              placeholderTextColor={Colors.neutralGrayLight}
              value={profile?.[key] || ''}
              onChangeText={(v) => editable && setProfile((p: any) => ({ ...p, [key]: v }))}
              editable={editable}
            />
          </View>
        ))}

        {/* Email notifications */}
        <Text style={[settingsStyles.cardTitle, { marginTop: 24 }]}>Email notifications</Text>
        {['marketing', 'order_updates', 'weekly_digest'].map((n) => (
          <View key={n} style={settingsStyles.checkRow}>
            <Switch
              value={notifications.includes(n)}
              onValueChange={(v) =>
                setNotifications((prev) =>
                  v ? [...prev, n] : prev.filter((x) => x !== n),
                )
              }
              trackColor={{ true: Colors.primary, false: Colors.neutralGrayLight }}
            />
            <Text style={settingsStyles.checkLabel}>
              {n === 'marketing'    ? 'Marketing emails' :
               n === 'order_updates'? 'Order update emails' :
               'Weekly digest'}
            </Text>
          </View>
        ))}

        {/* Save button */}
        <TouchableOpacity
          style={settingsStyles.saveBtn}
          onPress={handleSave}
          disabled={updating}>
          {updating ? <ActivityIndicator color="#fff" /> : <Text style={settingsStyles.saveBtnText}>Save changes</Text>}
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={settingsStyles.logoutBtn} onPress={handleLogout}>
        <Text style={settingsStyles.logoutBtnText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ── AddressSettings (translation of web AddressSettings.tsx) ─────────────────
const AddressSettings = () => {
  const [addresses,  setAddresses]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    label: '', address_line_1: '', address_line_2: '',
    city: '', country: '', zone: '', is_default: false,
  });

  const countries = Country.getAllCountries();
  const selectedCountry = countries.find((c) => c.name === form.country);
  const zones = selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : [];

  useEffect(() => {
    const fetch_ = async () => {
      const token = await getAuthToken();
      if (!token) { setLoading(false); return; }
      try {
        const res = await axios.get(`${BASE_URL}/api/addresses/`, {
          headers: { Authorization: `Token ${token}` },
        });
        setAddresses(res.data);
      } catch { } finally { setLoading(false); }
    };
    fetch_();
  }, []);

  const handleAdd = async () => {
    const token = await getAuthToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/addresses/`, form, {
        headers: { Authorization: `Token ${token}` },
      });
      setAddresses((prev) => [...prev, res.data]);
      setShowForm(false);
      Toast.show({ type: 'success', text1: 'Address added!' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to add address.' });
    } finally { setSubmitting(false); }
  };

  if (loading) return <Shimmer />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={settingsStyles.sectionHeading}>Address</Text>

      {/* Existing addresses */}
      {addresses.map((addr) => (
        <View key={addr.id} style={settingsStyles.addressCard}>
          <View style={settingsStyles.addressCardHeader}>
            <Text style={settingsStyles.addressLabel}>{addr.label}</Text>
            {addr.is_default && (
              <View style={settingsStyles.defaultBadge}>
                <Text style={settingsStyles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          <Text style={settingsStyles.addressLine}>{addr.address_line_1}</Text>
          {addr.address_line_2 ? <Text style={settingsStyles.addressLine}>{addr.address_line_2}</Text> : null}
          <Text style={settingsStyles.addressLine}>{addr.city}, {addr.country}</Text>
        </View>
      ))}

      {/* Add address form */}
      {!showForm ? (
        <TouchableOpacity style={settingsStyles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={settingsStyles.addBtnText}>+ Add new address</Text>
        </TouchableOpacity>
      ) : (
        <View style={settingsStyles.card}>
          <Text style={settingsStyles.cardTitle}>New Address</Text>
          {[
            { label: 'Label',           key: 'label',           placeholder: 'e.g. Home, Work' },
            { label: 'Address Line 1',  key: 'address_line_1',  placeholder: 'Street address' },
            { label: 'Address Line 2',  key: 'address_line_2',  placeholder: 'Apt, suite (optional)' },
            { label: 'City',            key: 'city',            placeholder: 'City' },
          ].map(({ label, key, placeholder }) => (
            <View key={key} style={settingsStyles.field}>
              <Text style={settingsStyles.fieldLabel}>{label}</Text>
              <TextInput
                style={settingsStyles.fieldInput}
                placeholder={placeholder}
                placeholderTextColor={Colors.neutralGrayLight}
                value={(form as any)[key]}
                onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
              />
            </View>
          ))}
          <TouchableOpacity
            style={settingsStyles.saveBtn}
            onPress={handleAdd}
            disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={settingsStyles.saveBtnText}>Save Address</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[settingsStyles.logoutBtn, { marginTop: 8 }]}
            onPress={() => setShowForm(false)}>
            <Text style={settingsStyles.logoutBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

// ── PaymentSettings (translation of web PaymentSettings.tsx) ─────────────────
const PaymentSettings = () => {
  const [payments,  setPayments]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [submitting,setSubmitting]= useState(false);
  const [form, setForm] = useState({
    card_number: '', expiration: '', cvc: '', cardholder_name: '',
  });

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1-');
  };
  const formatExpiration = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (digits.length < 3) return digits;
    return digits.replace(/^(\d{2})(\d{0,4})/, '$1/$2');
  };

  useEffect(() => {
    const fetch_ = async () => {
      const token = await getAuthToken();
      if (!token) { setLoading(false); return; }
      try {
        const res = await axios.get(`${BASE_URL}/api/payment-methods/`, {
          headers: { Authorization: `Token ${token}` },
        });
        setPayments(res.data);
      } catch { } finally { setLoading(false); }
    };
    fetch_();
  }, []);

  const handleAdd = async () => {
    const token = await getAuthToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/payment-methods/`, form, {
        headers: { Authorization: `Token ${token}` },
      });
      setPayments((prev) => [...prev, res.data]);
      setShowForm(false);
      Toast.show({ type: 'success', text1: 'Payment method added!' });
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to add payment method.' });
    } finally { setSubmitting(false); }
  };

  if (loading) return <Shimmer />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={settingsStyles.sectionHeading}>Payment method</Text>

      {payments.map((p) => (
        <View key={p.id} style={settingsStyles.paymentCard}>
          <VisaIcon width={48} height={32} />
          <View>
            <Text style={settingsStyles.maskedCard}>{p.masked_card}</Text>
            <Text style={settingsStyles.cardExpiry}>Expires {p.expiration}</Text>
            <Text style={settingsStyles.cardHolder}>{p.cardholder_name}</Text>
          </View>
        </View>
      ))}

      {!showForm ? (
        <TouchableOpacity style={settingsStyles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={settingsStyles.addBtnText}>+ Add payment method</Text>
        </TouchableOpacity>
      ) : (
        <View style={settingsStyles.card}>
          <Text style={settingsStyles.cardTitle}>New Card</Text>
          <View style={settingsStyles.field}>
            <Text style={settingsStyles.fieldLabel}>Card number</Text>
            <TextInput
              style={settingsStyles.fieldInput}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              placeholderTextColor={Colors.neutralGrayLight}
              keyboardType="number-pad"
              value={form.card_number}
              onChangeText={(v) => setForm((f) => ({ ...f, card_number: formatCardNumber(v) }))}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[settingsStyles.field, { flex: 1 }]}>
              <Text style={settingsStyles.fieldLabel}>Expiration (MM/YYYY)</Text>
              <TextInput
                style={settingsStyles.fieldInput}
                placeholder="MM/YYYY"
                placeholderTextColor={Colors.neutralGrayLight}
                keyboardType="number-pad"
                value={form.expiration}
                onChangeText={(v) => setForm((f) => ({ ...f, expiration: formatExpiration(v) }))}
              />
            </View>
            <View style={[settingsStyles.field, { flex: 1 }]}>
              <Text style={settingsStyles.fieldLabel}>CVC</Text>
              <TextInput
                style={settingsStyles.fieldInput}
                placeholder="CVC"
                placeholderTextColor={Colors.neutralGrayLight}
                keyboardType="number-pad"
                maxLength={4}
                value={form.cvc}
                onChangeText={(v) => setForm((f) => ({ ...f, cvc: v.replace(/\D/g, '').slice(0, 4) }))}
              />
            </View>
          </View>
          <View style={settingsStyles.field}>
            <Text style={settingsStyles.fieldLabel}>Cardholder name</Text>
            <TextInput
              style={settingsStyles.fieldInput}
              placeholder="Name on card"
              placeholderTextColor={Colors.neutralGrayLight}
              value={form.cardholder_name}
              onChangeText={(v) => setForm((f) => ({ ...f, cardholder_name: v }))}
            />
          </View>
          <TouchableOpacity
            style={settingsStyles.saveBtn}
            onPress={handleAdd}
            disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={settingsStyles.saveBtnText}>Add Card</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

// ── SecuritySettings (translation of web SecuritySettings.tsx) ────────────────
const SecuritySettings = () => {
  const [phone,    setPhone]    = useState('');
  const [currentPw,setCurrentPw]= useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confirmPw,setConfirmPw]= useState('');
  const [loading2FA, setLoading2FA] = useState(false);
  const [loadingPw,  setLoadingPw]  = useState(false);

  const handleTurnOn2FA = async () => {
    const token = await getAuthToken();
    if (!token) return;
    setLoading2FA(true);
    try {
      await axios.post(`${BASE_URL}/api/enable-2fa/`, { phone_number: phone }, {
        headers: { Authorization: `Token ${token}` },
      });
      Toast.show({ type: 'success', text1: '2FA enabled successfully!' });
    } catch { Toast.show({ type: 'error', text1: 'Failed to enable 2FA.' }); }
    finally { setLoading2FA(false); }
  };

  const handleChangePw = async () => {
    if (newPw !== confirmPw) { Toast.show({ type: 'error', text1: 'Passwords do not match.' }); return; }
    const token = await getAuthToken();
    if (!token) return;
    setLoadingPw(true);
    try {
      await axios.post(`${BASE_URL}/api/change-password/`, {
        current_password: currentPw,
        new_password:     newPw,
      }, { headers: { Authorization: `Token ${token}` } });
      Toast.show({ type: 'success', text1: 'Password changed successfully!' });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch { Toast.show({ type: 'error', text1: 'Failed to change password.' }); }
    finally { setLoadingPw(false); }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={settingsStyles.sectionHeading}>Security</Text>

      {/* 2FA section */}
      <View style={settingsStyles.card}>
        <Text style={settingsStyles.cardTitle}>2-factor authentication</Text>
        <View style={settingsStyles.field}>
          <Text style={settingsStyles.fieldLabel}>Phone number</Text>
          <TextInput
            style={settingsStyles.fieldInput}
            placeholder="(123) 456-7891"
            placeholderTextColor={Colors.neutralGrayLight}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
        </View>
        <TouchableOpacity
          style={settingsStyles.saveBtn}
          onPress={handleTurnOn2FA}
          disabled={loadingPw}>
          {loading2FA ? <ActivityIndicator color="#fff" /> : <Text style={settingsStyles.saveBtnText}>Turn on</Text>}
        </TouchableOpacity>
      </View>

      {/* Change password section */}
      <View style={settingsStyles.card}>
        <Text style={settingsStyles.cardTitle}>Change password</Text>
        {[
          { label: 'Current password',    value: currentPw, set: setCurrentPw, placeholder: 'Enter current password' },
          { label: 'New password',         value: newPw,     set: setNewPw,     placeholder: 'Enter new password' },
          { label: 'Confirm new password', value: confirmPw, set: setConfirmPw, placeholder: 'Confirm new password' },
        ].map(({ label, value, set, placeholder }) => (
          <View key={label} style={settingsStyles.field}>
            <Text style={settingsStyles.fieldLabel}>{label}</Text>
            <TextInput
              style={settingsStyles.fieldInput}
              placeholder={placeholder}
              placeholderTextColor={Colors.neutralGrayLight}
              secureTextEntry
              value={value}
              onChangeText={set}
            />
          </View>
        ))}
        <TouchableOpacity
          style={settingsStyles.saveBtn}
          onPress={handleChangePw}
          disabled={loadingPw}>
          {loadingPw ? <ActivityIndicator color="#fff" /> : <Text style={settingsStyles.saveBtnText}>Change password</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [tab,  setTab]  = useState(1);

  const renderContent = () => {
    switch (tab) {
      case 1: return <AccountSettings />;
      case 2: return <AddressSettings />;
      case 3: return <PaymentSettings />;
      case 4: return <SecuritySettings />;
      default:return <AccountSettings />;
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header />

      <View style={styles.layout}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>Settings</Text>
          {NAV_ITEMS.map(({ id, Icon, label, description }) => {
            const isActive = tab === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => setTab(id)}>
                <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
                  <Icon size={20} color={isActive ? Colors.primary : Colors.neutralGray} />
                </View>
                <View style={styles.navTextWrap}>
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{label}</Text>
                  <Text style={styles.navDesc}>{description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderContent()}
        </View>
      </View>

      <MobileFooterNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.neutralWhite },
  layout: { flex: 1, flexDirection: 'column' },
  // Sidebar — top tabs on mobile (lg:flex-row on web)
  sidebar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: Colors.neutralWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutralGrayLightest,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutralBlack,
    marginBottom: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  navItemActive: { backgroundColor: Colors.primaryLight },
  navIconWrap: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  navIconWrapActive: { backgroundColor: 'rgba(5,74,134,0.1)' },
  navTextWrap: { flex: 1 },
  navLabel: { fontSize: 14, fontWeight: '500', color: Colors.neutralBlack },
  navLabelActive: { color: Colors.primary, fontWeight: '600' },
  navDesc: { fontSize: 12, color: Colors.neutralGray, marginTop: 1 },
  content: { flex: 1, padding: 16, paddingBottom: 0 },
});

const settingsStyles = StyleSheet.create({
  sectionHeading: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutralBlack,
    letterSpacing: 0.1,
    marginBottom: 16,
    lineHeight: 28,
  },
  card: {
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: Colors.neutralWhite,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.neutralBlack,
    marginBottom: 24,
  },
  field: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.neutralGrayDark,
    marginBottom: 6,
    lineHeight: 16,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: Colors.neutralGrayLight,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: Colors.neutralBlack,
    backgroundColor: Colors.neutralWhite,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  checkLabel: { fontSize: 14, color: Colors.neutralBlack },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: Colors.neutralWhite, fontWeight: '700', fontSize: 14 },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  addBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  addBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  // Address card
  addressCard: {
    borderWidth: 1, borderColor: Colors.neutralGrayLightest,
    borderRadius: 12, padding: 16, marginBottom: 12,
    backgroundColor: Colors.neutralWhite,
  },
  addressCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  addressLabel: { fontSize: 16, fontWeight: '700', color: Colors.neutralBlack },
  defaultBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  defaultBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  addressLine: { fontSize: 14, color: Colors.neutralGrayDark, lineHeight: 20 },
  // Payment card
  paymentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: Colors.neutralGrayLightest,
    borderRadius: 12, padding: 16, marginBottom: 12,
    backgroundColor: Colors.neutralWhite,
  },
  cardIcon: { width: 48, height: 32 },
  maskedCard: { fontSize: 16, fontWeight: '600', color: Colors.neutralBlack, fontFamily: 'monospace' },
  cardExpiry: { fontSize: 12, color: Colors.neutralGray, marginTop: 2 },
  cardHolder: { fontSize: 13, color: Colors.neutralGrayDark, marginTop: 2 },
});
