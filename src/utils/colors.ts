/**
 * Exact color tokens from Dosta web app's index.css CSS variables.
 * Every value verified against the source.
 */
export const Colors = {
  // Primary palette
  primaryDark:          '#012E4E',  // --primary-dark   (Header, Footer, MobileFooterNav bg)
  primary:              '#054A86',  // --primary / #054A86 used inline throughout
  primaryDefault:       '#04406E',  // hsl(203 94% 22%) — primary DEFAULT
  primaryLight:         '#E9F5FF',  // --primary-light
  primaryLighter:       '#D4EFFF',  // --primary-lighter
  primaryHover:         '#0564C1',  // --primary-hover
  primaryBlue:          '#056AC1',  // used for links
  primary3d:            '#04A3FA',

  // Secondary
  secondary:            '#FF5C60',  // CTA buttons (red), destructive
  secondaryRed:         '#EE3123',  // promo banner red bg
  secondaryDark:        '#FF0522',  // --secondary DEFAULT

  // Tertiary
  green:                '#A7CF38',  // tag badges on ShowCase cards
  purple:               '#8C3EFF',  // newsletter links
  purpleLight:          '#E0E7FE',

  // Neutral scale
  neutralBlack:         '#2B2B43',  // text-[#2B2B43] inline headings
  neutralDark:          '#202E41',  // --neutral-black
  neutralGrayDark:      '#545563',  // text-[#545563] / --neutral-gray-dark
  neutralGray:          '#A4AAB2',  // --neutral-gray
  neutralGrayLight:     '#C7C8D2',  // border-[#C7C8D2]
  neutralGrayLightest:  '#EDEEF2',  // bg-[#EDEEF2] inputs, dividers
  neutralWhite:         '#FFFFFF',

  // Page backgrounds
  background:           '#F7F7F9',  // --background, page bg
  cardBg:               '#FFFFFF',

  // Semantic
  error:                '#FF5C4D',
  success:              '#1AB77D',
  orange:               '#F97316',  // "Only N left" badge, heating button
};

/**
 * Spacing scale — mirrors Tailwind defaults used in web.
 * All values in logical pixels.
 */
export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

/**
 * Typography scale — mirrors exact font sizes used in web components.
 */
export const FontSize = {
  xs:   10,
  sm:   12,
  base: 14,
  md:   16,
  lg:   20,
  xl:   24,
  '2xl': 28,
  '3xl': 32,
  '4xl': 36,
  '5xl': 40,
  hero:  48,
};

export const FontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
  extrabold:'800' as const,
};

/**
 * Border radius — mirrors Tailwind rounded-* values used in web.
 */
export const Radius = {
  sm:   8,   // rounded-[8px]  — buttons
  md:   12,  // rounded-[12px] — inputs
  lg:   16,  // rounded-[16px] — cards
  xl:   24,  // rounded-2xl
  full: 9999,
};
