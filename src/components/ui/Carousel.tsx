/**
 * Carousel — horizontal ScrollView-based pager with autoplay.
 * Uses ScrollView (not FlatList) because programmatic scrollTo is reliable on Android,
 * whereas FlatList.scrollToIndex/scrollToOffset can silently no-op when pagingEnabled
 * is on and a snap is mid-flight.
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
  ScrollView,
  View,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
    onSnapToItem,
    style,
  }: CarouselProps<T>,
  ref: React.Ref<CarouselRef>,
) {
  const scrollRef = useRef<ScrollView>(null);
  const currentIndex = useRef(0);
  const userInteracting = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const goTo = useCallback(
    (index: number, animated = true) => {
      const count = data.length;
      if (!count || !scrollRef.current) return;
      const safeIndex = ((index % count) + count) % count;
      currentIndex.current = safeIndex;
      scrollRef.current.scrollTo({
        x: safeIndex * width,
        y: 0,
        animated,
      });
      setActiveIndex(safeIndex);
      onSnapToItem?.(safeIndex);
    },
    [data.length, width, onSnapToItem],
  );

  useImperativeHandle(ref, () => ({
    next: () => goTo(currentIndex.current + 1),
    prev: () => goTo(currentIndex.current - 1),
    scrollTo: goTo,
  }));

  useEffect(() => {
    if (!autoPlay || data.length < 2) return;
    const interval = setInterval(() => {
      if (userInteracting.current) return;
      goTo(currentIndex.current + 1);
    }, autoPlayInterval);
    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, data.length, goTo]);

  const handleScrollBeginDrag = useCallback(() => {
    userInteracting.current = true;
  }, []);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      userInteracting.current = false;
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / width);
      if (index !== currentIndex.current) {
        currentIndex.current = index;
        setActiveIndex(index);
        onSnapToItem?.(index);
      }
    },
    [width, onSnapToItem],
  );

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onScrollBeginDrag={handleScrollBeginDrag}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      style={[{ width, height }, style]}
      contentContainerStyle={{ height }}
      scrollEventThrottle={16}
      decelerationRate="fast"
      bounces={false}
      overScrollMode="never">
      {data.map((item, index) => (
        <View key={index} style={{ width, height }}>
          {renderItem({ item, index })}
        </View>
      ))}
    </ScrollView>
  );
}

const Carousel = forwardRef(CarouselInner) as <T>(
  props: CarouselProps<T> & { ref?: React.Ref<CarouselRef> },
) => React.ReactElement;

export default Carousel;
