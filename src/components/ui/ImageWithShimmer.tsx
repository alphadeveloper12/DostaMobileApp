/**
 * ImageWithShimmer — translation of web components/ui/ImageWithShimmer.tsx
 *
 * Web: shows a shimmer placeholder while image loads, fades in on load.
 * Uses expo-image which handles placeholder + transition natively.
 */

import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/utils/colors';

interface Props {
  src: string;
  alt?: string;
  style?: StyleProp<ViewStyle>;
  className?: string;
  wrapperClassName?: string;
  // explicit dimensions when className not sufficient
  width?: number | string;
  height?: number | string;
}

export default function ImageWithShimmer({ src, alt, style, width, height }: Props) {
  return (
    <Image
      source={{ uri: src }}
      placeholder={{ color: Colors.neutralGrayLightest }}
      transition={300}
      contentFit="cover"
      accessibilityLabel={alt}
      style={[
        styles.img,
        width !== undefined ? { width } : undefined,
        height !== undefined ? { height } : undefined,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  img: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.neutralGrayLightest,
  },
});
