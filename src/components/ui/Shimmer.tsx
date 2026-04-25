/**
 * Shimmer — translation of web components/ui/Shrimmer.tsx
 * Web: skeleton loader used while fetching menu / cart data.
 * Shows a grid of pulsing placeholder cards matching MenuItemCard dimensions.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Colors } from '@/utils/colors';

const ShimmerBox = ({ style }: { style?: object }) => (
  <MotiView
    style={[styles.box, style]}
    from={{ opacity: 0.4 }}
    animate={{ opacity: 1 }}
    transition={{ type: 'timing', duration: 700, loop: true }}
  />
);

export default function Shimmer() {
  return (
    <View style={styles.grid}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={styles.card}>
          {/* Image area — h-[180px] matching MenuItemCard */}
          <ShimmerBox style={styles.imageArea} />
          {/* Title */}
          <ShimmerBox style={styles.title} />
          {/* Description line 1 */}
          <ShimmerBox style={styles.desc} />
          {/* Price */}
          <ShimmerBox style={styles.price} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 16,
  },
  card: {
    width: '47%',
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,                // rounded-[16px]
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  box: {
    backgroundColor: Colors.neutralGrayLightest,
    borderRadius: 8,
  },
  imageArea: {
    width: '100%',
    height: 160,                     // close to web h-[180px]
    borderRadius: 0,
    marginBottom: 10,
  },
  title: {
    height: 20,
    marginHorizontal: 12,
    marginBottom: 6,
    width: '70%',
  },
  desc: {
    height: 14,
    marginHorizontal: 12,
    marginBottom: 4,
    width: '90%',
  },
  price: {
    height: 16,
    marginHorizontal: 12,
    width: '30%',
  },
});
