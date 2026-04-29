/**
 * CateringConfirmationScreen — faithful translation of web CateringConfirmation.tsx
 *
 * Web structure:
 *   Header
 *   BreadCrumb + h1 "Catering Service Confirmation" md:text-4xl font-bold text-primary
 *   Two-column grid:
 *   LEFT:
 *     Booking Header Card (border border-[#EDEEF2] rounded-2xl bg-white):
 *       Order ID p text-[24px] font-bold
 *       Status dot + "In progress" / "Completed"
 *       [Cancel Booking] outline | [Reschedule Booking] primary buttons
 *     Booking Details card:
 *       h2 "Booking details" text-[24px] font-bold
 *       Row("Event Type", value) | Row("Service Style") | Row("Cuisines") | Row("Location") | Row("Budget")
 *   RIGHT:
 *     (web shows TotalOrders — but mobile shows summary card)
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import BreadCrumb from '@/components/ui/BreadCrumb';

const Row = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  ) : null;

export default function CateringConfirmationScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { orderId, orderDetails } = route.params || {};
  const [step, setStep] = React.useState(1);

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <Header variant="catering" />

      {/* bg-neutral-white title bar */}
      <View style={s.titleBar}>
        <BreadCrumb />
        <Text style={s.pageTitle}>Catering Service Confirmation</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>

        {/* Booking Header Card */}
        <View style={s.card}>
          {/* Order ID + status */}
          <View style={s.cardSection}>
            <Text style={s.orderId}>Order ID {orderId || '—'}</Text>
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: step === 1 ? Colors.primary : '#1ABF70' }]} />
              <Text style={s.statusText}>{step === 1 ? 'In progress' : 'Completed'}</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.outlineBtn}
              onPress={() => navigation.navigate('RequestCustomQuote')}>
              <Text style={s.outlineBtnText}>Cancel Booking</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => navigation.navigate('RequestCustomQuote')}>
              <Text style={s.primaryBtnText}>Reschedule Booking</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Booking Details Card */}
        <View style={s.card}>
          <Text style={s.detailsTitle}>Booking details</Text>
          <View style={s.divider} />
          <Row label="Event Type"    value={orderDetails?.event_type} />
          <Row label="Guests"        value={orderDetails?.guest_count ? `${orderDetails.guest_count} Guests` : undefined} />
          <Row label="Date"          value={orderDetails?.event_date} />
          <Row label="Service Style" value={orderDetails?.service_style} />
          <Row label="Location"      value={orderDetails?.location} />
          <Row label="Budget"        value={orderDetails?.budget} />
        </View>

        {/* Next Steps */}
        <View style={s.nextCard}>
          <Text style={s.nextTitle}>What happens next?</Text>
          <Text style={s.nextItem}>✓ A Dosta coordinator will contact you within 24 hours.</Text>
          <Text style={s.nextItem}>✓ You'll receive a detailed proposal and quote.</Text>
          <Text style={s.nextItem}>✓ Once approved, your caterer will be assigned.</Text>
        </View>

        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => navigation.navigate('Home')}>
          <Text style={s.primaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>

      <MobileFooterNav />
    </View>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.background },
  titleBar:     { backgroundColor: Colors.neutralWhite, paddingHorizontal: 16, paddingBottom: 24, paddingTop: 4 },
  pageTitle:    { fontSize: 28, fontWeight: '700', color: Colors.primary, lineHeight: 36 },
  card:         { backgroundColor: Colors.neutralWhite, borderRadius: 16, borderWidth: 1, borderColor: Colors.neutralGrayLightest, marginBottom: 16, overflow: 'hidden' },
  cardSection:  { padding: 16 },
  orderId:      { fontSize: 24, fontWeight: '700', color: Colors.neutralBlack, marginBottom: 8, lineHeight: 32 },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusText:   { fontSize: 14, fontWeight: '600', color: Colors.neutralBlack },
  actionsRow:   { flexDirection: 'row', gap: 12, padding: 16, paddingTop: 0, flexWrap: 'wrap' },
  outlineBtn:   { flex: 1, height: 44, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText:{ fontSize: 14, fontWeight: '600', color: Colors.primary },
  primaryBtn:   { flex: 1, height: 44, borderRadius: 8, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText:{ fontSize: 14, fontWeight: '600', color: Colors.neutralWhite },
  detailsTitle: { fontSize: 24, fontWeight: '700', color: Colors.neutralBlack, padding: 16, lineHeight: 32 },
  divider:      { height: 1, backgroundColor: Colors.neutralGrayLightest },
  row:          { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.neutralGrayLightest },
  rowLabel:     { fontSize: 14, color: Colors.neutralGrayDark, fontWeight: '500', marginBottom: 2 },
  rowValue:     { fontSize: 16, fontWeight: '700', color: Colors.primaryBlue },
  nextCard:     { backgroundColor: Colors.primaryLight, borderRadius: 16, padding: 20, marginBottom: 16 },
  nextTitle:    { fontSize: 16, fontWeight: '700', color: Colors.primary, marginBottom: 12 },
  nextItem:     { fontSize: 14, color: Colors.neutralBlack, marginBottom: 8, lineHeight: 20 },
});
