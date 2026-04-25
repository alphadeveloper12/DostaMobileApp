/**
 * Button — equivalent of shadcn Button used throughout the web app.
 *
 * Web variants used:
 *   default    → bg-[#054A86] text-white         (primary)
 *   secondary  → bg-white text-neutral-gray-dark  (light)
 *   outline    → border border-[#054A86] text-primary transparent bg
 *   destructive→ bg-[#FF5C60] text-white
 *   ghost      → transparent, no border
 *
 * Web sizes:
 *   default → py-[12px] px-[16px] text-[14px]
 *   sm      → py-[8px] px-[12px] text-[12px]
 *   lg      → py-[14px] px-[20px] text-[16px]
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { Colors } from '@/utils/colors';

type Variant = 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost';
type Size    = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps {
  variant?:  Variant;
  size?:     Size;
  disabled?: boolean;
  loading?:  boolean;
  onPress?:  () => void;
  children:  React.ReactNode;
  style?:    StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function Button({
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  onPress,
  children,
  style,
  textStyle,
}: ButtonProps) {
  const containerStyle = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    (disabled || loading) && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    styles[`labelSize_${size}`],
    styles[`labelVariant_${variant}`],
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? Colors.primary : Colors.neutralWhite}
          size="small"
        />
      ) : (
        <Text style={labelStyle}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,               // rounded-[8px]
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  disabled: {
    opacity: 0.5,
  },

  // Sizes — match web py/px values
  size_default: {
    paddingVertical: 12,           // py-[12px]
    paddingHorizontal: 16,         // px-[16px]
  },
  size_sm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  size_lg: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  size_icon: {
    width: 40,
    height: 40,
    padding: 0,
  },

  // Variants
  variant_default: {
    backgroundColor: Colors.primary,  // bg-[#054A86]
  },
  variant_secondary: {
    backgroundColor: Colors.neutralWhite,
  },
  variant_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  variant_destructive: {
    backgroundColor: Colors.secondary, // bg-[#FF5C60]
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },

  // Label base
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  labelSize_default: { fontSize: 14 },
  labelSize_sm:      { fontSize: 12 },
  labelSize_lg:      { fontSize: 16 },
  labelSize_icon:    { fontSize: 14 },

  // Label colors by variant
  labelVariant_default:     { color: Colors.neutralWhite },
  labelVariant_secondary:   { color: Colors.neutralDark },
  labelVariant_outline:     { color: Colors.primary },
  labelVariant_destructive: { color: Colors.neutralWhite },
  labelVariant_ghost:       { color: Colors.primary },
});
