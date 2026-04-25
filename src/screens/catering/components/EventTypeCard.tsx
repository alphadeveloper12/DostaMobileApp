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
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '@/utils/colors';

const W = (Dimensions.get('window').width - 56) / 2;

interface Props {
  image:    string;
  title:    string;
  selected?: boolean;
  onPress?: () => void;
}

export default function EventTypeCard({ image, title, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[s.card, selected && s.cardActive]}
      onPress={onPress}
      activeOpacity={0.85}>
      {/* h-48 (192px) image with margin + rounded */}
      <View style={s.imgWrap}>
        <Image source={{ uri: image }} style={s.img} contentFit="cover" />
      </View>
      {/* Title centered */}
      <View style={s.titleWrap}>
        <Text style={[s.title, selected && s.titleActive]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    width: W,
    backgroundColor: Colors.neutralWhite,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.neutralGrayLight,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  imgWrap: {
    margin: 10,
    borderRadius: 12,
    overflow: 'hidden',
    height: 160,
  },
  img: { width: '100%', height: '100%' },
  titleWrap: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4 },
  title: { fontSize: 16, fontWeight: '500', color: Colors.neutralBlack, textAlign: 'center' },
  titleActive: { color: Colors.primary, fontWeight: '600' },
});
