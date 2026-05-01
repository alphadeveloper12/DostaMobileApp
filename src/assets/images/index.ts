/**
 * Local asset map — all images required from the local filesystem.
 * PNG/JPG → require() (bundled with app, works offline)
 * SVG    → require() via react-native-svg-transformer (renders as RN component)
 *
 * These are the same files from Dosta/public/images/ copied during Phase 2.
 */

// ── Navigation ──────────────────────────────────────────────────────────────
export const LogoSvg       = require('./nav/logo.svg').default;
export const DostaBlue     = require('./nav/dosta_blue.svg').default;
export const CateringLogo  = require('./nav/catering_logo.svg').default;
export const VendingLogo   = require('./nav/vending_logo.svg').default;
export const UserProfile   = require('./nav/user_profile.svg').default;
export const SearchBox     = require('./nav/searchbox.svg').default;
export const CrossBox      = require('./nav/crossbox.svg').default;

// ── Bottom nav icons ─────────────────────────────────────────────────────────
export const IconHome      = require('./icons/dosta_home.svg').default;
export const IconHomeB     = require('./icons/dosta_home_b.svg').default;
export const IconServices  = require('./icons/services.svg').default;
export const IconOrders    = require('./icons/orders.svg').default;
export const IconSettings  = require('./icons/settings.svg').default;
export const IconSearch    = require('./icons/search.svg').default;
export const IconInbox     = require('./icons/inbox.svg').default;
export const IconLocation  = require('./icons/locaion-icon.svg').default;
export const IconCalendar  = require('./icons/calendar.svg').default;
export const IconDelete    = require('./icons/delete.svg').default;
export const IconRoundTick = require('./icons/round_tick.svg').default;
export const IconVisa      = require('./icons/visa.svg').default;
export const IconMastercard= require('./icons/mastercard.svg').default;
export const IconPromoburger = require('./icons/promoburger.svg').default;
export const IconPromomobile = require('./icons/promomobile.svg').default;

// ── Header hero slides (PNG) ─────────────────────────────────────────────────
export const HeroChef   = require('./header/cheff.png');
export const HeroSlide2 = require('./header/Slide2.png');
export const HeroSlide3 = require('./header/Slide3.png');
export const HeroSlide4 = require('./header/Slide4.png');

// ── ShowCase card images ──────────────────────────────────────────────────────
export const Card2Jpg    = require('./header/card2.jpg');
export const Card3Jpg    = require('./header/card3.jpeg');
export const Card4Jpg    = require('./header/card4.jpg');

// ── Vending home ─────────────────────────────────────────────────────────────
export const HeroVending  = require('./vending_home/hero-vending.png');
export const MealBrowse   = require('./vending_home/meal_browes.png');

// ── Company logos (SVG) ───────────────────────────────────────────────────────
export const Companies = [
  require('./company/c1.svg').default,
  require('./company/c2.svg').default,
  require('./company/c3.svg').default,
  require('./company/c4.svg').default,
  require('./company/c5.svg').default,
  require('./company/c6.svg').default,
  require('./company/c7.svg').default,
  require('./company/c8.svg').default,
  require('./company/c9.svg').default,
  require('./company/c10.svg').default,
  require('./company/c11.svg').default,
  require('./company/c12.svg').default,
];

// ── Auth ──────────────────────────────────────────────────────────────────────
export const AuthSliderImage = require('./auth/slider-image.jpg');
