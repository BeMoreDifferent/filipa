import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
} from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { defaultStyles, Spacing, BorderRadius } from '@/constants/Styles';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SegmentOption<T> {
  label: string;
  value: T;
  icon?: React.ReactNode;
}

interface SettingsSegmentedControlProps<T> {
  options: Array<SegmentOption<T>>;
  selectedValue: T;
  onValueChange: (value: T) => void;
}

// Create a reusable Animated Button component internally
const AnimatedSegmentButton = <T extends string | number>({
  option,
  isSelected,
  isLast,
  onPress,
  styles,
  colors,
}: {
  option: SegmentOption<T>;
  isSelected: boolean;
  isLast: boolean;
  onPress: (value: T) => void;
  styles: any; // Pass down the styles object
  colors: any; // Pass down colors
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current; // Initial scale value

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96, // Scale down slightly
      useNativeDriver: true, // Use native driver for performance
      friction: 7,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1, // Scale back to normal
      useNativeDriver: true,
      friction: 7,
    }).start();
    // Call the original onPress handler passed from the parent
    onPress(option.value);
  };

  return (
    <TouchableOpacity
      key={option.value}
      style={[
        styles.segmentButton,
        !isLast && { marginRight: Spacing.sm },
        isSelected && styles.segmentButtonSelected,
      ]}
      onPressIn={handlePressIn} // Animate on press in
      onPressOut={handlePressOut} // Animate on press out and call main handler
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={option.label}
      activeOpacity={1} // Disable default opacity feedback
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }], // Apply the scale animation
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {option.icon &&
          React.cloneElement(option.icon as React.ReactElement, {
            color: isSelected ? colors.primary : colors.text,
            style: styles.iconStyle,
          } as any)
        }
        <Text
          style={[
            styles.segmentText,
            isSelected && styles.segmentTextSelected,
          ]}
        >
          {option.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const SettingsSegmentedControl = <T extends string | number>({
  options,
  selectedValue,
  onValueChange,
}: SettingsSegmentedControlProps<T>) => {
  const { colors } = useTheme();

  const handlePress = (value: T) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onValueChange(value);
  };

  const styles = StyleSheet.create({
    groupContainer: {
      padding: Spacing.sm,
    },
    innerContainer: {
      flexDirection: 'row',
    },
    segmentButton: {
      flex: 1,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.xs,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    segmentButtonSelected: {
      borderColor: colors.primary,
      borderRadius: BorderRadius.md,
    },
    iconStyle: {
      marginRight: Spacing.xs,
    },
    segmentText: {
      ...defaultStyles.textBody,
      color: colors.text,
      textAlign: 'center',
    },
    segmentTextSelected: {
      ...defaultStyles.textBody,
      color: colors.primary,
      fontWeight: '500',
    },
  });

  return (
    <View style={styles.groupContainer}>
      <View style={styles.innerContainer}>
        {options.map((option, index) => {
          const isSelected = selectedValue === option.value;
          const isLast = index === options.length - 1;

          return (
            <AnimatedSegmentButton
              key={option.value}
              option={option}
              isSelected={isSelected}
              isLast={isLast}
              onPress={handlePress}
              styles={styles}
              colors={colors}
            />
          );
        })}
      </View>
    </View>
  );
};

export default SettingsSegmentedControl; 