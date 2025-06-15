import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider'; // Adjust path
import { Spacing } from '@/constants/Styles'; // Adjust path if adding spacing props

interface StyledViewProps extends ViewProps {
  // Example: Add padding props based on Spacing constants
  padding?: keyof typeof Spacing;
  paddingHorizontal?: keyof typeof Spacing;
  paddingVertical?: keyof typeof Spacing;
  // Add more specific spacing props if needed (e.g., paddingBottom)
}

/**
 * A base View component that applies the theme background color.
 * Can be extended to accept spacing props based on constants.
 */
export const StyledView = ({ 
  style = {}, // Default style to an empty object
  padding,
  paddingHorizontal,
  paddingVertical,
  ...props 
}: StyledViewProps) => {
  const { colors } = useTheme();

  // Create dynamic styles for spacing based on props
  const spacingStyles = StyleSheet.create({
    dynamic: {
      padding: padding ? Spacing[padding] : undefined,
      paddingHorizontal: paddingHorizontal ? Spacing[paddingHorizontal] : undefined,
      paddingVertical: paddingVertical ? Spacing[paddingVertical] : undefined,
      // Add logic for other spacing props here
    },
  }).dynamic;

  return (
    <View
      style={[
        { backgroundColor: colors.background }, // Apply background from theme
        spacingStyles, // Apply dynamic spacing
        style, // Apply custom styles last
      ]}
      {...props}
    />
  );
}; 