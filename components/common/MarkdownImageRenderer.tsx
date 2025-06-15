import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, LayoutChangeEvent } from 'react-native';
import { Image, ImageLoadEventData } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { useTheme } from '@/providers/ThemeProvider';
import { Spacing, BorderRadius } from '@/constants/Styles';
import { downloadAndSaveImage } from '@/utils/Image';

interface MarkdownImageRendererProps {
  src: string;
  alt?: string;
}

/**
 * Renders an image from a URL with pinch-to-zoom functionality centered on the pinch focal point.
 * The image can be zoomed in up to 1.2 times its actual size (capped at 5x the container size)
 * and will spring back to its original fitted size and position upon release.
 * It also includes a download button for the image.
 *
 * @param src The URL of the image to display.
 * @param alt The alt text for the image, used for accessibility.
 */
const MarkdownImageRenderer: React.FC<MarkdownImageRendererProps> = ({ src, alt }) => {
  const [isLoading, setIsLoading] = useState(true);
  const { colors, theme } = useTheme();
  // JS state for dimensions, used to update shared values
  const [_imageDimensions, setImageDimensionsState] = useState({ width: 0, height: 0 });
  const [_containerWidth, setContainerWidthState] = useState(0);

  // Reanimated shared values for pinch gesture
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const gestureStartFocalX = useSharedValue(0);
  const gestureStartFocalY = useSharedValue(0);

  // Shared values for dimensions, to be used in worklets
  const imageActualWidth = useSharedValue(0);
  const viewContainerWidth = useSharedValue(0);


  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value }
      ],
    };
  });

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      gestureStartFocalX.value = event.focalX;
      gestureStartFocalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const currentGestureScale = event.scale; // Scale factor for the current pinch
      const newOverallScale = savedScale.value * currentGestureScale;

      let maxCalculatedScale = 3; // Default max scale
      if (imageActualWidth.value > 0 && viewContainerWidth.value > 0) {
        const targetDisplayWidth = 1.2 * imageActualWidth.value;
        maxCalculatedScale = targetDisplayWidth / viewContainerWidth.value;
      }
      
      const finalMaxScale = Math.min(Math.max(1, maxCalculatedScale), 5);
      const clampedOverallScale = Math.max(1, Math.min(newOverallScale, finalMaxScale));

      // Calculate the content point that was under gestureStartFocalX at gesture start
      // (contentOriginX, contentOriginY) are coordinates within the unscaled, untranslated content
      const contentOriginX = (gestureStartFocalX.value - savedTranslateX.value) / savedScale.value;
      const contentOriginY = (gestureStartFocalY.value - savedTranslateY.value) / savedScale.value;

      // New translation to keep contentOriginX/Y under event.focalX/Y (current focal point)
      const newTranslateX = event.focalX - (contentOriginX * clampedOverallScale);
      const newTranslateY = event.focalY - (contentOriginY * clampedOverallScale);
      
      scale.value = clampedOverallScale;
      translateX.value = newTranslateX;
      translateY.value = newTranslateY;
    })
    .onEnd(() => {
      const springConfig = { stiffness: 300, damping: 25, mass: 1 };
      scale.value = withSpring(1, springConfig);
      translateX.value = withSpring(0, springConfig);
      translateY.value = withSpring(0, springConfig);
    });

  const handleDownload = async () => {
    try {
      await downloadAndSaveImage(src);
      runOnJS(Alert.alert)('Success', 'Image downloaded and saved to gallery!');
    } catch (error) {
      console.error("Failed to download image:", error);
      runOnJS(Alert.alert)('Error', 'Failed to download image.');
    }
  };

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const newWidth = event.nativeEvent.layout.width;
    setContainerWidthState(newWidth);
    viewContainerWidth.value = newWidth; // Update shared value
  };

  const handleImageLoad = (event: ImageLoadEventData) => {
    const { width, height } = event.source;
    setImageDimensionsState({ width, height });
    imageActualWidth.value = width; // Update shared value
  };
  
  return (
    <View 
      style={styles(colors, theme).outerContainer} 
      onLayout={handleContainerLayout}
    >
      <GestureDetector gesture={pinchGesture}>
        <Animated.View style={[styles(colors, theme).animatedView, animatedStyle]}>
          <Image
            source={{ uri: src }}
            style={styles(colors, theme).image}
            contentFit="contain"
            onLoad={handleImageLoad}
            onLoadEnd={() => setIsLoading(false)}
            accessibilityLabel={alt || 'Markdown Image'}
            accessible={true}
          />
        </Animated.View>
      </GestureDetector>
      {isLoading && (
        <ActivityIndicator
          style={styles(colors, theme).loadingIndicator}
          size="large"
          color={colors.primary}
        />
      )}
      {!isLoading && (
        <TouchableOpacity style={styles(colors, theme).downloadButton} onPress={handleDownload} accessibilityLabel="Download image" accessible={true}>
          <Ionicons 
            name="download-outline" 
            size={24} 
            color={theme === 'dark' ? Colors.grey[200] : Colors.grey[700]}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = (colors: typeof Colors.light, theme: 'light' | 'dark') => StyleSheet.create({
  outerContainer: {
    width: '100%',
    aspectRatio: 1, 
    marginBottom: Spacing.md,
    overflow: 'hidden', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedView: { 
    width: '100%',
    height: '100%',
    justifyContent: 'center', 
    alignItems: 'center',    
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingIndicator: {
    position: 'absolute',
  },
  downloadButton: {
    position: 'absolute',
    top: Spacing.sm, 
    right: Spacing.sm,
    backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)', 
    padding: Spacing.xs,
    borderRadius: BorderRadius.md, 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
});

export default MarkdownImageRenderer; 