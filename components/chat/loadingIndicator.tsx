import React from 'react';
import { View, StyleSheet, ActivityIndicatorProps, ViewProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
  interpolate,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Spacing, BorderRadius } from '@/constants/Styles';
import { Colors } from '@/constants/Colors';

/**
 * LoadingIndicator is a drop-in replacement for ActivityIndicator.
 * It displays a smooth, organic three-dot loading animation.
 * All ActivityIndicator props are supported.
 *
 * @param {ActivityIndicatorProps} props - Standard ActivityIndicator props
 * @returns {JSX.Element | null}
 * @example <LoadingIndicator size="large" color="#007AFF" animating={true} />
 */
const DOTS = 3;
const BOUNCE_HEIGHT = Spacing.sm; // 8
const DURATION = 420;
const SIZE_MAP = {
  small: Spacing.md, // 16
  large: Spacing.xl, // 32
};
const DEFAULT_COLOR = Colors.light.primary;

const LoadingIndicator: React.FC<ActivityIndicatorProps & ViewProps> = ({
  animating = true,
  color = DEFAULT_COLOR,
  size = 'small',
  hidesWhenStopped = true,
  style,
  ...rest
}) => {
  // Hide if not animating and hidesWhenStopped is true
  if (!animating && hidesWhenStopped) return null;

  // Normalize size
  const dotSize = typeof size === 'number' ? size : SIZE_MAP[size] || SIZE_MAP.small;

  // Always call hooks at the top level
  const offset0 = useSharedValue(0);
  const offset1 = useSharedValue(0);
  const offset2 = useSharedValue(0);
  const offsets = [offset0, offset1, offset2];

  React.useEffect(() => {
    let isMounted = true;
    if (!animating) return;
    offsets.forEach((offset, i) => {
      const loop = () => {
        offset.value = withDelay(
          i * (DURATION / DOTS),
          withSequence(
            withTiming(-BOUNCE_HEIGHT, {
              duration: DURATION,
              easing: Easing.out(Easing.cubic),
            }),
            withTiming(0, {
              duration: DURATION,
              easing: Easing.bounce,
            }, (finished?: boolean) => {
              if (finished && isMounted) runOnJS(loop)();
            }),
            withDelay(DURATION * (DOTS - 1), withTiming(0, { duration: 0 })),
          ),
        );
      };
      loop();
    });
    return () => {
      isMounted = false;
    };
  }, [animating]);

  // Animated styles: scale and opacity in sync with bounce
  const animatedStyles = [offset0, offset1, offset2].map((offset) =>
    useAnimatedStyle(() => {
      // offset.value: 0 (rest) to -BOUNCE_HEIGHT (peak)
      // Map to scale: 1 (rest) to 1.25 (peak)
      // Map to opacity: 0.5 (rest) to 1 (peak)
      const progress = -offset.value / BOUNCE_HEIGHT; // 0 at rest, 1 at peak
      const scale = interpolate(progress, [0, 1], [1, 1.25]);
      const opacity = interpolate(progress, [0, 1], [0.5, 1]);
      return {
        transform: [
          { translateY: offset.value },
          { scale },
        ],
        opacity,
      };
    })
  );

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={[styles.container, style]}
      {...rest}
    >
      {offsets.map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            animatedStyles[i],
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color,
              marginHorizontal: dotSize * 0.25,
            },
          ]}
          accessibilityLabel="Loading dot"
          accessible={false}
        />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing.lg, // 24
  },
  dot: {
    // dynamic styles applied inline
  },
});

export default LoadingIndicator;