/**
 * HomeScreen — faithful translation of:
 *   web: pages/Index.tsx
 *        components/home/HeroSection.tsx   (react-slick carousel, 4 slides)
 *        components/home/ShowCase.tsx      (3-card grid with images)
 *        components/home/PromoBanners.tsx  (2 colored banners)
 *        components/home/Companies.tsx     (12 company logos)
 *        components/home/Newsletter.tsx    (email subscription)
 *
 * Web HeroSection:
 *   - bg-primary-dark (#012E4E) full section
 *   - react-slick: fade carousel, 4 slides, autoplay 3000ms
 *   - Each slide: text left + image right (flex-row on md, flex-col-reverse on mobile)
 *   - Slide text: h1 lg:text-[40px] font-[800] text-white, p font-[700] text-white
 *   - CTA button: bg-[#FF5C60] rounded-[8px] text-[14px] font-[700]
 *   - Image: h-[361px] object-cover rounded-[24px] border-2 border-[#A7CF38]
 *   - framer-motion: text slides in from left, image from right on slide change
 *
 * Web ShowCase:
 *   - bg-[#F7F7F9], grid 3 cols (sm:2), cards -mt-[145px] (overlap hero)
 *   - Card: max-w-[350px] h-[478px] rounded-[16px] shadow-xl white bg
 *   - Image top: h-[224px] object-cover rounded-t-[16px]
 *   - Tag badge: bg-[#A7CF38] text-primary-dark text-[10px] font-[700] bottom-[-14px]
 *   - Title: text-[28px] font-[700] text-primary (#04406E)
 *   - Button: border border-[#054A86] text-[14px] rounded-[8px]
 *
 * Web PromoBanners:
 *   - 2 banners flex-row, each max-w-[540px] min-h-[180px] rounded-xl
 *   - Banner 1: bg #EE3123, "Top Deals", burger image
 *   - Banner 2: bg #054A86, "Get the Dosta App", mobile image
 *   - Button: bg-white text-neutral-gray-dark h-[30px] rounded-[16px] font-[800] text-[12px]
 *
 * Web Companies:
 *   - bg-[#F7F7F9], h3 text-[28px] text-[#054A86] "Trusted by Leading Brands"
 *   - 12 logos grid-cols-6 (desktop), 2-3 cols mobile, each 120–160px
 *
 * Web Newsletter:
 *   - bg-[#EDEEF2], centered text-primary h2 "Subscribe for exclusive offers"
 *   - Input w-[327px] h-[44px] + Subscribe button bg-[#FF5C60]
 *   - Privacy note text-[14px] with purple (#8C3EFF) links
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  StyleSheet,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Carousel from '@/components/ui/Carousel';
import { MotiView } from 'moti';

// Local SVG assets as React components
import Card2Svg       from '@/assets/images/header/card2.svg';
import Card4Svg       from '@/assets/images/header/card4.svg';
import PromoburgerSvg from '@/assets/images/icons/promoburger.svg';
import PromomobileSvg from '@/assets/images/icons/promomobile.svg';
import { Colors } from '@/utils/colors';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileFooterNav from '@/components/layout/MobileFooterNav';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Slide data — exact from web HeroSection.tsx ──────────────────────────────
const SLIDER_DATA = [
  {
    title: 'Innovation Meets Nutrition!',
    description:
      "We're on a mission to transform how people experience healthy food, with chef-designed meals, smart technology, and a touch of surprise.",
    image: require('@/assets/images/header/cheff.png'),
    buttonText: 'Explore Our Services',
    buttonLink: 'Services',
  },
  {
    title: 'Chef-Prepared Meals Crafted for Quality & Consistency',
    description:
      'Fresh meals prepared daily by professional chefs, designed for individuals, businesses, and modern lifestyles across Dubai.',
    image: require('@/assets/images/header/Slide2.png'),
    buttonText: 'View Our Food Services',
    buttonLink: 'Services',
  },
  {
    title: 'Corporate & Event Catering Services in Dubai',
    description:
      'Customized catering solutions for corporate events, private gatherings, and special occasions — delivered with consistency and care.',
    image: require('@/assets/images/header/Slide3.png'),
    buttonText: 'Request a Quote',
    buttonLink: 'RequestCustomQuote',
  },
  {
    title: 'Smart Food Ordering Starts Here',
    description:
      'Download the DOSTA app and enjoy 15% off your first order with FIRST15.',
    image: require('@/assets/images/header/Slide4.png'),
    buttonText: 'Download App',
    buttonLink: 'Home',
  },
];

// ── ShowCase data — exact from web ShowCase.tsx ───────────────────────────────
// SVG icons are imported as React components; JPEG as require()
const SHOWCASE_STEPS = [
  {
    IconComponent: Card2Svg,
    imgSource:     null,
    title:  'Meals on Your Schedule',
    description: 'Plan your week with nutritious meals placed in vending stations near you',
    tag:    'DOSTA VENDING',
    button: 'Start Planning',
    link:   'VendingHome',
  },
  {
    IconComponent: Card4Svg,
    imgSource:     null,
    title:  'Flavorful Catering for Any Event',
    description: 'From private gatherings to grand celebrations, we craft unforgettable meals',
    tag:    'DOSTA CATERING',
    button: 'Book Your Event',
    link:   'CateringHome',
  },
  {
    IconComponent: null,
    imgSource:     require('@/assets/images/header/card3.jpeg'),
    title:  'Delightful Sweets for Happy Occasions',
    description: 'Dosta Sweets offers a wide range of sweets for any occasion.',
    tag:    'DOSTA SWEETS',
    button: 'Browse Menu',
    link:   'DostaSweets',
  },
];

// ── PromoData — exact from web PromoBanners.tsx ───────────────────────────────
const PROMO_DATA = [
  {
    title:         'Top Deals',
    description:   'Eat well. Pay less. Now with tasty savings!',
    buttonText:    'Coming Soon',
    ImageComponent:PromoburgerSvg,
    bgColor:       '#EE3123',
    link:          '#',
  },
  {
    title:         'Get the Dosta App',
    description:   'Manage your deliveries from anywhere, anytime.',
    buttonText:    'Download App',
    ImageComponent:PromomobileSvg,
    bgColor:       '#054A86',
    link:          'https://play.google.com/store/apps/details?id=com.dosta.app',
  },
];

// Company logos — 12 total, imported as SVG components
import C1  from '@/assets/images/company/c1.svg';
import C2  from '@/assets/images/company/c2.svg';
import C3  from '@/assets/images/company/c3.svg';
import C4  from '@/assets/images/company/c4.svg';
import C5  from '@/assets/images/company/c5.svg';
import C6  from '@/assets/images/company/c6.svg';
import C7  from '@/assets/images/company/c7.svg';
import C8  from '@/assets/images/company/c8.svg';
import C9  from '@/assets/images/company/c9.svg';
import C10 from '@/assets/images/company/c10.svg';
import C11 from '@/assets/images/company/c11.svg';
import C12 from '@/assets/images/company/c12.svg';

const COMPANY_LOGOS = [C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11, C12];

// ── Hero Carousel Slide ───────────────────────────────────────────────────────
const HeroSlide = ({
  item,
  index,
}: {
  item: (typeof SLIDER_DATA)[0];
  index: number;
}) => {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.slide}>
      {/* Image — local require() for PNG slides */}
      <Image
        source={item.image}
        style={styles.slideImage}
        contentFit="cover"
      />
      {/* Green border ring — border-2 border-[#A7CF38] on web */}
      <View style={styles.slideImageBorder} />

      {/* Text content */}
      <MotiView
        from={{ opacity: 0, translateX: -40 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 600, delay: 100 }}
        style={styles.slideText}>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 200 }}>
          <Text style={styles.slideTitle}>{item.title}</Text>
        </MotiView>
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 300 }}>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </MotiView>
        <MotiView
          from={{ opacity: 0, translateY: 15 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500, delay: 450 }}>
          <TouchableOpacity
            style={styles.slideBtn}
            onPress={() => navigation.navigate(item.buttonLink)}>
            <Text style={styles.slideBtnText}>{item.buttonText}</Text>
          </TouchableOpacity>
        </MotiView>
      </MotiView>
    </View>
  );
};

// ── HeroSection ───────────────────────────────────────────────────────────────
const HeroSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <View style={styles.hero}>
      <Carousel
        width={SCREEN_W}
        height={480}
        autoPlay
        autoPlayInterval={3000}
        data={SLIDER_DATA}
        scrollAnimationDuration={1000}
        onSnapToItem={setActiveIndex}
        renderItem={({ item, index }) => (
          <HeroSlide item={item} index={index} />
        )}
      />
      {/* Pagination dots — same as web */}
      <View style={styles.dots}>
        {SLIDER_DATA.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
};

// ── ShowCase Card ─────────────────────────────────────────────────────────────
const ShowCaseCard = ({ step }: { step: (typeof SHOWCASE_STEPS)[0] }) => {
  const navigation = useNavigation<any>();
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate(step.link)}
      activeOpacity={0.9}>
      {/* Image top — h-[224px] */}
      <View style={styles.cardImageWrap}>
        {step.IconComponent ? (
          <step.IconComponent width="100%" height="100%" />
        ) : (
          <Image
            source={step.imgSource}
            style={styles.cardImage}
            contentFit="cover"
          />
        )}
        {/* Tag badge — bg-[#A7CF38] absolute bottom-[-14px] */}
        <View style={styles.tagBadge}>
          <Text style={styles.tagText}>{step.tag}</Text>
        </View>
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        {/* Title — text-[28px] font-[700] text-primary */}
        <Text style={styles.cardTitle}>{step.title}</Text>
        {/* Description — text-[14px] text-neutral-gray-dark */}
        <Text style={styles.cardDesc}>{step.description}</Text>
        {/* Outline button — border border-[#054A86] text-[14px] rounded-[8px] */}
        <TouchableOpacity
          style={styles.cardBtn}
          onPress={() => navigation.navigate(step.link)}>
          <Text style={styles.cardBtnText}>{step.button}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ── ShowCase Section ──────────────────────────────────────────────────────────
const ShowCase = () => (
  <View style={styles.showcase}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.showcaseScroll}>
      {SHOWCASE_STEPS.map((step) => (
        <ShowCaseCard key={step.tag} step={step} />
      ))}
    </ScrollView>
  </View>
);

// ── PromoBanners ──────────────────────────────────────────────────────────────
const PromoBanners = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.promoSection}>
      {PROMO_DATA.map((promo, index) => (
        <MotiView
          key={promo.title}
          from={{ opacity: 0, translateX: index === 0 ? -50 : 50 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'timing', duration: 600, delay: index * 150 }}
          style={[styles.promoBanner, { backgroundColor: promo.bgColor }]}>
          {/* Text side */}
          <View style={styles.promoTextSide}>
            {/* h3 text-[24px] font-[800] text-white */}
            <Text style={styles.promoTitle}>{promo.title}</Text>
            {/* p text-[16px] font-[700] text-white */}
            <Text style={styles.promoDesc}>{promo.description}</Text>
            {/* Button: bg-white text-neutral-gray-dark h-[30px] rounded-[16px] */}
            <TouchableOpacity style={styles.promoBtn}>
              <Text style={styles.promoBtnText}>{promo.buttonText}</Text>
            </TouchableOpacity>
          </View>
          {/* Image side — SVG component */}
          <promo.ImageComponent width={120} height="100%" />
        </MotiView>
      ))}
    </View>
  );
};

// ── Companies ─────────────────────────────────────────────────────────────────
const Companies = () => (
  <View style={styles.companiesSection}>
    {/* h3 text-[28px] font-[700] text-center text-[#054A86] */}
    <Text style={styles.companiesTitle}>Trusted by Leading Brands</Text>
    <Text style={styles.companiesSubtitle}>
      We proudly serve top companies with tailored catering solutions.
    </Text>
    {/* grid grid-cols-6 → FlatList numColumns=3 on mobile */}
    <FlatList
      data={COMPANY_LOGOS}
      numColumns={3}
      keyExtractor={(_, i) => String(i)}
      scrollEnabled={false}
      contentContainerStyle={styles.logosGrid}
      renderItem={({ item: LogoComponent, index }) => (
        <View key={index} style={styles.logoCell}>
          <LogoComponent width={100} height={100} />
        </View>
      )}
    />
  </View>
);

// ── Newsletter ────────────────────────────────────────────────────────────────
const Newsletter = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');

  return (
    <View style={styles.newsletter}>
      {/* h2 text-2xl md:text-3xl font-bold text-primary */}
      <Text style={styles.newsletterTitle}>Subscribe for exclusive offers</Text>
      {/* p text-neutral-gray-dark text-sm */}
      <Text style={styles.newsletterSubtitle}>
        Subscribe to our emails and get the latest product offers, recipe
        updates and more.
      </Text>

      {/* Email input row */}
      <View style={styles.emailRow}>
        <TextInput
          style={styles.emailInput}
          placeholder="Email"
          placeholderTextColor={Colors.neutralGray}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity style={styles.subscribeBtn}>
          {/* bg-[#FF5C60] text-[14px] font-[700] */}
          <Text style={styles.subscribeBtnText}>Subscribe</Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.newsletterDivider} />

      {/* Privacy note — text-[14px] with purple links */}
      <Text style={styles.privacyNote}>
        By providing your email you are agreeing to receive email marketing
        from Dosta Plazi. You can opt-out at any time. See{' '}
        <Text
          style={styles.privacyLink}
          onPress={() => navigation.navigate('Terms')}>
          Terms & Conditions
        </Text>{' '}
        and{' '}
        <Text
          style={styles.privacyLink}
          onPress={() => navigation.navigate('PrivacyPolicy')}>
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, paddingTop: insets.top }}>
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}>
        <HeroSection />
        <ShowCase />
        <PromoBanners />
        <Companies />
        <Newsletter />
        <Footer />
      </ScrollView>
      <MobileFooterNav />
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: Colors.primaryDark, // bg-primary-dark
    position: 'relative',
  },
  slide: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  slideImage: {
    width: '100%',
    height: 200,                // web: h-[361px] desktop → scaled for mobile
    borderRadius: 24,           // rounded-[24px]
    marginBottom: 20,
  },
  slideImageBorder: {
    // border-2 border-[#A7CF38] overlay on web — approximated as margin note
    // On mobile the image is the primary visual
  },
  slideText: {
    width: '100%',
  },
  slideTitle: {
    fontSize: 28,               // web lg:text-[40px], mobile text-[36px] → 28 on narrow
    fontWeight: '800',
    color: Colors.neutralWhite,
    lineHeight: 36,
    paddingBottom: 16,
    textAlign: 'center',        // max-md:text-center
  },
  slideDescription: {
    fontSize: 14,               // text-[16px] font-[700]
    fontWeight: '700',
    color: Colors.neutralWhite,
    lineHeight: 22,
    paddingBottom: 24,
    textAlign: 'center',
  },
  slideBtn: {
    alignSelf: 'center',
    backgroundColor: Colors.secondary,  // bg-[#FF5C60]
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  slideBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 16,
    backgroundColor: Colors.primaryDark,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: Colors.neutralWhite,
    width: 20,
  },

  // ── ShowCase ──────────────────────────────────────────────────────────────
  showcase: {
    backgroundColor: Colors.background,  // bg-[#F7F7F9]
    paddingTop: 24,
    paddingBottom: 24,
  },
  showcaseScroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  card: {
    width: 320,                  // close to max-w-[350px]
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,            // rounded-[16px]
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,                // shadow-xl
    overflow: 'visible',
  },
  cardImageWrap: {
    width: '100%',
    height: 224,                 // h-[224px]
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tagBadge: {
    position: 'absolute',
    bottom: -14,                 // bottom-[-14px]
    left: 16,                    // left-4
    backgroundColor: Colors.green, // bg-[#A7CF38]
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    zIndex: 10,
  },
  tagText: {
    color: Colors.primaryDark,   // text-primary-dark
    fontSize: 10,                // text-[10px]
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardBody: {
    paddingTop: 32,              // pt-[32px]
    paddingHorizontal: 24,       // px-[24px]
    paddingBottom: 24,
  },
  cardTitle: {
    fontSize: 24,                // text-[28px] → 24 on mobile
    fontWeight: '700',
    color: Colors.primaryDefault, // text-primary (#04406E)
    marginBottom: 8,
    lineHeight: 32,
  },
  cardDesc: {
    fontSize: 14,
    color: Colors.neutralGrayDark, // text-neutral-gray-dark
    lineHeight: 20,
    marginBottom: 24,
  },
  cardBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.primary,   // border-[#054A86]
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  cardBtnText: {
    fontSize: 14,
    color: Colors.primaryDark,
    letterSpacing: 0.3,
  },

  // ── PromoBanners ──────────────────────────────────────────────────────────
  promoSection: {
    backgroundColor: Colors.neutralWhite,
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 20,
  },
  promoBanner: {
    borderRadius: 12,            // rounded-xl
    flexDirection: 'row',
    overflow: 'hidden',
    minHeight: 160,              // md:min-h-[180px]
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  promoTextSide: {
    flex: 1,
    paddingTop: 17,
    paddingLeft: 20,             // md:pl-[32px]
    paddingBottom: 16,
    paddingRight: 8,
    justifyContent: 'center',
  },
  promoTitle: {
    fontSize: 22,                // text-[24px] font-[800]
    fontWeight: '800',
    color: Colors.neutralWhite,
    marginBottom: 4,
  },
  promoDesc: {
    fontSize: 14,                // text-[16px] font-[700]
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
    lineHeight: 20,
  },
  promoBtn: {
    backgroundColor: Colors.neutralWhite,
    height: 30,                  // h-[30px]
    borderRadius: 16,            // rounded-[16px]
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBtnText: {
    fontSize: 12,                // text-[12px]
    fontWeight: '800',
    color: Colors.neutralGrayDark,
    letterSpacing: 0.6,
  },
  promoImage: {
    width: 120,
    height: '100%',
  },

  // ── Companies ─────────────────────────────────────────────────────────────
  companiesSection: {
    backgroundColor: Colors.background, // bg-[#F7F7F9]
    paddingTop: 32,
    paddingBottom: 64,
    paddingHorizontal: 16,
  },
  companiesTitle: {
    fontSize: 24,                // text-[28px]
    fontWeight: '700',
    color: Colors.primary,       // text-[#054A86]
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  companiesSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.neutralGray,
    textAlign: 'center',
    marginBottom: 24,
  },
  logosGrid: {
    gap: 16,
  },
  logoCell: {
    flex: 1,
    margin: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: {
    width: 100,
    height: 100,
  },

  // ── Newsletter ─────────────────────────────────────────────────────────────
  newsletter: {
    backgroundColor: Colors.neutralGrayLightest, // bg-[#EDEEF2]
    paddingHorizontal: 16,
  },
  newsletterTitle: {
    fontSize: 24,                // text-2xl md:text-3xl
    fontWeight: '700',
    color: Colors.primary,       // text-primary
    textAlign: 'center',
    marginBottom: 12,
    paddingTop: 24,
  },
  newsletterSubtitle: {
    fontSize: 14,
    color: Colors.neutralGrayDark,
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 20,
  },
  emailRow: {
    flexDirection: 'row',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    marginBottom: 44,
    gap: 8,
  },
  emailInput: {
    flex: 1,
    height: 44,                  // h-[44px]
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.neutralGrayLight,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.neutralBlack,
    backgroundColor: Colors.neutralWhite,
  },
  subscribeBtn: {
    backgroundColor: Colors.secondary, // bg-[#FF5C60]
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeBtnText: {
    color: Colors.neutralWhite,
    fontWeight: '700',
    fontSize: 14,
  },
  newsletterDivider: {
    height: 1,
    backgroundColor: Colors.neutralGrayLight,
    marginBottom: 0,
  },
  privacyNote: {
    fontSize: 14,
    color: Colors.neutralBlack,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    lineHeight: 20,
  },
  privacyLink: {
    color: Colors.purple,        // text-[#8C3EEE]
  },
});
