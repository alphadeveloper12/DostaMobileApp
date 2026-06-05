/**
 * BeitNahlaCard — faithful translation of web
 * components/BeitNahla/BeitNahlaCard.tsx
 *
 * Web card (preserved):
 *   border #054A86 when selected, else #EDEEF2; rounded-[12px]/[16px]; white bg
 *   ImageWithShimmer h-[160px]/[220px]
 *   "Selected" badge top-2 right-2 bg-[#054A86]
 *   name text-[13px]/[18px] font-[700] text-[#2B2B43]
 *   priceLabel font-[700] + priceSuffix text-[#83859C]
 *   "See options ›" button bg-[#054A86]
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import ImageWithShimmer from '@/components/ui/ImageWithShimmer';
import { Colors } from '@/utils/colors';

export interface BeitNahlaImage {
  id: number;
  image_url: string;
  alt_text: string;
  order: number;
}

export interface MealBoxType {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  images: BeitNahlaImage[];
  display_order: number;
}

export interface SelectedMealBox {
  box: MealBoxType;
  selections: Record<number, number[]>; // categoryId -> [optionItemIds]
  unitPrice: number; // single-day or weekly bundle price
}

interface BeitNahlaCardProps {
  data: MealBoxType;
  priceLabel: string; // e.g. "AED 40.00"
  priceSuffix?: string; // e.g. "per box" or "per box · 6 days"
  isSelected: boolean;
  onSeeOptions: (box: MealBoxType) => void;
}

const PLACEHOLDER = 'https://placehold.co/400x300?text=Beit+Nahla';

export default function BeitNahlaCard({
  data,
  priceLabel,
  priceSuffix = 'per box',
  isSelected,
  onSeeOptions,
}: BeitNahlaCardProps) {
  const allImages =
    data.images && data.images.length > 0
      ? data.images.map((img) => img.image_url)
      : [data.image_url || PLACEHOLDER];

  return (
    <View style={[styles.card, isSelected && styles.cardSelected]}>
      {/* Image */}
      <View style={styles.imageWrap}>
        <ImageWithShimmer src={allImages[0]} alt={data.name} style={styles.image} />
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {data.name}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>{priceLabel}</Text>
            <Text style={styles.priceSuffix}>{priceSuffix}</Text>
          </View>

          <TouchableOpacity
            style={styles.seeBtn}
            activeOpacity={0.85}
            onPress={() => onSeeOptions(data)}>
            <Text style={styles.seeBtnText}>See options</Text>
            <ChevronRight size={14} color={Colors.neutralWhite} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 12, // rounded-[12px]
    borderWidth: 1,
    borderColor: Colors.neutralGrayLightest, // #EDEEF2
    padding: 8, // px-2 pt-2 pb-4 (mobile)
    paddingBottom: 16,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: Colors.primary, // #054A86
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    height: 160, // h-[160px]
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  selectedBadgeText: {
    color: Colors.neutralWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  body: {
    paddingTop: 12,
    flex: 1,
  },
  name: {
    fontSize: 13, // text-[13px]
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.1,
    color: Colors.neutralBlack, // #2B2B43
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 'auto',
  },
  priceCol: {
    flexShrink: 1,
  },
  priceLabel: {
    fontSize: 13, // text-[13px]
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
    color: Colors.neutralBlack,
  },
  priceSuffix: {
    fontSize: 9, // text-[9px]
    color: '#83859C',
    fontWeight: '500',
    marginTop: 2,
  },
  seeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  seeBtnText: {
    color: Colors.neutralWhite,
    fontSize: 11,
    fontWeight: '700',
  },
});
