/**
 * CateringHomeScreen — faithful 1:1 translation of web catering home
 * Source: pages/catering/pages/Index.tsx → HeroSection + HowItWorks + PromoBanners + Newsletter
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';
import Newsletter from '@/components/ui/Newsletter';
import HeaderCardIcon from '@/assets/images/header/headercardicon.svg';
import CateringStyleIcon from '@/assets/images/header/catle.svg';
import DeliverIcon from '@/assets/images/header/deleiver.svg';
import CalendarIcon from '@/assets/images/header/calender.svg';
import PromoburgerSvg from '@/assets/images/icons/promoburger.svg';
import PromomobileSvg from '@/assets/images/icons/promomobile.svg';

const STEPS = [
  { Icon: CateringStyleIcon, title: 'Select Your Catering Style', description: "Choose from a variety of catering styles. Whether it's a corporate lunch or a private celebration, our fully customizable menu caters to all the staff events you host." },
  { Icon: DeliverIcon, title: 'Set Your Event Details', description: "Let us know the event date, time, and guest count. We'll handle the food planning, preparation, and delivery, so you don't have to worry about anything." },
  { Icon: CalendarIcon, title: 'Relax While We Deliver', description: 'Sit back and leave the rest to us. Your order will be delivered fresh and on time to your specified location, ensuring everything runs smoothly on the day.' },
];

const PROMO_DATA = [
  { title: 'Top Deals', description: 'Eat well. Pay less. Now with tasty savings!', buttonText: 'Coming Soon', ImageComp: PromoburgerSvg, bgColor: '#EE3123' },
  { title: 'Get the Dosta App', description: 'Manage your deliveries from anywhere, anytime.', buttonText: 'Download App', ImageComp: PromomobileSvg, bgColor: '#054A86' },
];

export default function CateringHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <Header />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* ── HeroSection ────────────────────────────────────── */}
        <View style={s.heroSection}>
          <Image source={require('@/assets/images/header/header.svg')} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <View style={s.heroOverlay} />
          <View style={s.heroCardWrap}>
            <View style={s.heroCard}>
              <Text style={s.heroTitle}>Catering for Every Occasion</Text>
              <Text style={s.heroSubtitle}>
                From boardrooms to backyards, plan your event meals with ease by our expert Catering team.
              </Text>
              <TouchableOpacity style={s.heroCTA} onPress={() => navigation.navigate('CateringPlan')}>
                <Text style={s.heroCTAText}>Start planning your event</Text>
              </TouchableOpacity>
              <View style={s.heroIllust}>
                <HeaderCardIcon width={280} height={80} />
              </View>
            </View>
          </View>
        </View>

        {/* ── HowItWorks ──────────────────────────────────────── */}
        <View style={s.howSection}>
          <Text style={s.howTitle}>How We Make It Happen</Text>
          <View style={s.stepsWrap}>
            {STEPS.map(({ Icon, title, description }) => (
              <View key={title} style={s.stepCard}>
                <View style={s.stepIconCircle}>
                  <Icon width={32} height={32} />
                </View>
                <Text style={s.stepTitle}>{title}</Text>
                <Text style={s.stepDesc}>{description}</Text>
              </View>
            ))}
          </View>
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity style={s.howCTA} onPress={() => navigation.navigate('CateringPlan')}>
              <Text style={s.howCTAText}>Let's Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── PromoBanners ────────────────────────────────────── */}
        <View style={s.promoSection}>
          {PROMO_DATA.map(({ title, description, buttonText, ImageComp, bgColor }) => (
            <View key={title} style={[s.promoBanner, { backgroundColor: bgColor }]}>
              <View style={s.promoTextSide}>
                <Text style={s.promoTitle}>{title}</Text>
                <Text style={s.promoDesc}>{description}</Text>
                <TouchableOpacity style={s.promoBtn}>
                  <Text style={s.promoBtnText}>{buttonText}</Text>
                </TouchableOpacity>
              </View>
              <ImageComp width={120} height="100%" />
            </View>
          ))}
        </View>

        <Newsletter />
        <Footer />
      </ScrollView>
      <MobileFooterNav />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.neutralWhite },
  heroSection: { minHeight: 460, position: 'relative', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 20 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.20)' },
  heroCardWrap: { width: '100%', paddingHorizontal: 16, zIndex: 10, marginTop: 16 },
  heroCard: { backgroundColor: Colors.neutralWhite, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 10, alignItems: 'center' },
  heroTitle: { fontSize: 28, fontWeight: '700', color: Colors.primary, textAlign: 'center', marginBottom: 16, lineHeight: 36 },
  heroSubtitle: { fontSize: 16, fontWeight: '600', color: Colors.neutralGrayDark, textAlign: 'center', lineHeight: 24, marginBottom: 20, paddingHorizontal: 8 },
  heroCTA: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 16 },
  heroCTAText: { color: Colors.neutralWhite, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  heroIllust: { alignItems: 'center', marginTop: 8 },
  howSection: { backgroundColor: Colors.neutralWhite, paddingTop: 48, paddingBottom: 24, paddingHorizontal: 16 },
  howTitle: { fontSize: 28, fontWeight: '700', color: Colors.primary, textAlign: 'center', letterSpacing: 0.1, marginBottom: 24 },
  stepsWrap: { gap: 16, marginBottom: 24 },
  stepCard: { backgroundColor: Colors.neutralWhite, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4, alignItems: 'center' },
  stepIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  stepTitle: { fontSize: 16, fontWeight: '600', color: Colors.primary, textAlign: 'center', marginBottom: 12 },
  stepDesc: { fontSize: 14, color: Colors.neutralGrayDark, textAlign: 'center', lineHeight: 20 },
  howCTA: { backgroundColor: Colors.primary, paddingVertical: 16, paddingHorizontal: 16, borderRadius: 8 },
  howCTAText: { color: Colors.neutralWhite, fontSize: 14, fontWeight: '600' },
  promoSection: { backgroundColor: Colors.neutralWhite, paddingTop: 24, paddingBottom: 48, paddingHorizontal: 16, gap: 20 },
  promoBanner: { borderRadius: 12, flexDirection: 'row', overflow: 'hidden', minHeight: 152, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  promoTextSide: { flex: 1, paddingTop: 17, paddingLeft: 24, paddingBottom: 16, paddingRight: 8, justifyContent: 'center' },
  promoTitle: { fontSize: 18, fontWeight: '700', color: Colors.neutralWhite, marginBottom: 4 },
  promoDesc: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 12, lineHeight: 20 },
  promoBtn: { backgroundColor: Colors.neutralWhite, height: 30, borderRadius: 16, paddingHorizontal: 12, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
  promoBtnText: { fontSize: 12, fontWeight: '600', color: Colors.neutralBlack },
});
