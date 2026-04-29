/**
 * ImageLightbox — full-screen image preview, port of the web lightbox
 * defined in `components/vending_home/PlanWeekly.tsx` (lines ~664-695)
 * and the matching block in `Menu.tsx`.
 *
 * Web parity:
 *   • Backdrop: `bg-black/90`, full screen, taps anywhere close.
 *   • Image: `object-contain` (RN: `contentFit="contain"`),
 *     90vw × 90vh, rounded-[16px], shadow.
 *   • Close pill: small white circle with X, top-right, outside the image.
 *   • "Click anywhere to close" caption near the bottom.
 *   • Spring-scale entrance (stiffness 300, damping 28).
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { X } from 'lucide-react-native';
import { Colors } from '@/utils/colors';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  uri:     string | null | undefined;
  onClose: () => void;
}

export default function ImageLightbox({ visible, uri, onClose }: Props) {
  if (!uri) return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      {/* Tap anywhere on the backdrop to close. */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          {/* Inner content — stop tap propagation so a tap on the image
              doesn't dismiss the modal. */}
          <TouchableWithoutFeedback>
            <MotiView
              from={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={styles.imageWrap}>
              <Image
                source={{ uri }}
                style={styles.image}
                contentFit="contain"
              />
              {/* Close pill — sits outside the image's top-right corner */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={10}>
                <X size={20} color="#1F2937" />
              </TouchableOpacity>
            </MotiView>
          </TouchableWithoutFeedback>

          <Text style={styles.caption}>Tap anywhere to close</Text>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const IMG_W = Math.round(W * 0.9);
const IMG_H = Math.round(H * 0.78);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    width: IMG_W,
    height: IMG_H,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  image: {
    width:  '100%',
    height: '100%',
    borderRadius: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: -16,
    right: -16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.neutralWhite,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  caption: {
    position: 'absolute',
    bottom: 24,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
});
