/**
 * EventTypeCard — translation of web pages/catering/components/catering/EventTypeCard.tsx
 *
 * Web:
 *   Card: cursor-pointer rounded-2xl overflow-hidden transition-all bg-white
 *     active: border-[2px] border-[#054A86] bg-[#EAF5FF]
 *     inactive: border-[2px] border-[#C7C8D2]
 *   Image inside: h-48 margin-[12px] rounded-[16px]
 *   Title: font-medium text-[16px] text-center
 *     active: text-[#054A86] font-semibold
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/utils/colors';

interface Props {
  image:    string;
  title:    string;
  selected?: boolean;
  onPress?: () => void;
}

// Width is controlled by the parent (`width: '48%'`) so the layout adapts to
// any combination of paddings without hard-coded screen-width math.
export default function EventTypeCard({ image, title, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[s.card, selected && s.cardActive]}
      onPress={onPress}
      activeOpacity={0.85}>
      <View style={s.imgWrap}>
        <Image source={{ uri: image }} style={s.img} contentFit="cover" />
      </View>
      <View style={s.titleWrap}>
        <Text style={[s.title, selected && s.titleActive]} numberOfLines={2}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.neutralGrayLight,
    overflow: 'hidden',         // clips the image to the card's rounded top
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  // Image fills the card edge-to-edge. The card's `overflow: 'hidden'` +
  // `borderRadius: 16` clips the top corners; no inner margin or radius
  // needed on the image itself.
  imgWrap: {
    width: '100%',
    aspectRatio: 1,
  },
  img: { width: '100%', height: '100%' },
  titleWrap: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 12 },
  title: { fontSize: 14, fontWeight: '500', color: Colors.neutralBlack, textAlign: 'center', lineHeight: 18 },
  titleActive: { color: Colors.primary, fontWeight: '700' },
});
