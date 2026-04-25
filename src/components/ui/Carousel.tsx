/**
 * Carousel — drop-in replacement for react-native-reanimated-carousel.
 * Uses FlatList with pagingEnabled + auto-play timer.
 * Zero external dependencies beyond React Native core.
 *
 * API mirrors the subset of react-native-reanimated-carousel we use:
 *   <Carousel
 *     width={number}
 *     height={number}
 *     data={array}
 *     renderItem={({ item, index }) => JSX}
 *     autoPlay?={boolean}
 *     autoPlayInterval?={number}   (ms, default 3000)
 *     scrollAnimationDuration?={number}
 *     onSnapToItem?={(index) => void}
 *     loop?={boolean}
 *   />
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  FlatList,
  View,
  Dimensions,
} from 'react-native';

interface CarouselProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactElement;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  scrollAnimationDuration?: number;
  onSnapToItem?: (index: number) => void;
  loop?: boolean;
  style?: object;
}

export interface CarouselRef {
  next: () => void;
  prev: () => void;
  scrollTo: (index: number) => void;
}

function CarouselInner<T>(
  {
    data,
    renderItem,
    width = Dimensions.get('window').width,
    height = 300,
    autoPlay = false,
    autoPlayInterval = 3000,
    scrollAnimationDuration = 600,
    onSnapToItem,
    loop = true,
    style,
  }: CarouselProps<T>,
  ref: React.Ref<CarouselRef>,
) {
  const flatListRef = useRef<FlatList<T>>(null);
  const currentIndex  = useRef(0);
  const [, setRender] = useState(0); // force re-render for index tracking

  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      const count = data.length;
      if (!count) return;
      const safeIndex = ((index % count) + count) % count;
      currentIndex.current = safeIndex;
      flatListRef.current?.scrollToIndex({
        index: safeIndex,
        animated,
        viewPosition: 0,
      });
      onSnapToItem?.(safeIndex);
      setRender((n) => n + 1);
    },
    [data.length, onSnapToItem],
  );

  // Expose prev/next/scrollTo for arrow buttons (VendingHomeScreen)
  useImperativeHandle(ref, () => ({
    next: () => scrollToIndex(currentIndex.current + 1),
    prev: () => scrollToIndex(currentIndex.current - 1),
    scrollTo: scrollToIndex,
  }));

  // Auto-play
  useEffect(() => {
    if (!autoPlay || data.length < 2) return;
    const interval = setInterval(() => {
      scrollToIndex(currentIndex.current + 1);
    }, autoPlayInterval);
    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, data.length, scrollToIndex]);

  const handleMomentumScrollEnd = useCallback(
    (e: any) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index   = Math.round(offsetX / width);
      currentIndex.current = index;
      onSnapToItem?.(index);
      setRender((n) => n + 1);
    },
    [width, onSnapToItem],
  );

  return (
    <FlatList<T>
      ref={flatListRef}
      data={data}
      renderItem={({ item, index }) => (
        <View style={{ width, height }}>
          {renderItem({ item, index })}
        </View>
      )}
      keyExtractor={(_, i) => String(i)}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      getItemLayout={(_, index) => ({
        length: width,
        offset: width * index,
        index,
      })}
      style={[{ width, height }, style]}
      scrollEventThrottle={16}
      decelerationRate="fast"
      bounces={false}
    />
  );
}

const Carousel = forwardRef(CarouselInner) as <T>(
  props: CarouselProps<T> & { ref?: React.Ref<CarouselRef> },
) => React.ReactElement;

export default Carousel;
