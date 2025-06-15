import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider'; // Adjust path
import { defaultStyles } from '@/constants/Styles'; // Adjust path, remove FontSize, LineHeight, Fonts

type TextVariant = 'body' | 'heading' | 'subheading' | 'caption' | 'button';
// type TextWeight = 'regular' | 'medium' | 'bold'; // TextWeight might be determined by defaultStyles or systemWeights now

interface StyledTextProps extends TextProps {
  variant?: TextVariant;
  // weight?: TextWeight; // Re-evaluate if weight prop is still needed or how it integrates with defaultStyles
  color?: string; // Allow overriding theme color
  style?: TextProps['style'];
}

/**
 * A base Text component that applies theme colors and default text styles.
 * It supports different variants (body, heading, etc.) and weights,
 * respects font scaling, and allows style overrides.
 */
export const StyledText = ({
  variant = 'body',
  // weight, // Temporarily remove weight as its direct mapping to Fonts.medium etc. is gone
  color,
  style,
  ...props
}: StyledTextProps) => {
  const { colors } = useTheme();

  const variantStyleMap = {
    body: defaultStyles.textBody,
    heading: defaultStyles.textHeading,
    subheading: defaultStyles.textSubheading, // Use pre-composed style
    caption: defaultStyles.textCaption,
    button: defaultStyles.buttonText,
  };

  const selectedVariantStyle = variantStyleMap[variant];

  // Determine the font family based on weight override or variant default
  // const defaultWeightFont = (selectedVariantStyle as any)?.fontFamily || defaultStyles.textBody.fontFamily; // Get default from style or fallback
  // const finalWeight = weight || (defaultWeightFont === Fonts.medium ? 'medium' : defaultWeightFont === Fonts.bold ? 'bold' : 'regular');
  // const fontWeightStyle = { fontFamily: Fonts[finalWeight] };
  // The fontWeight is now typically part of the defaultStyles (e.g., systemWeights.bold in textHeading)
  // If a 'weight' prop is still desired, it would need to map to systemWeights from react-native-typography

  // Allow font scaling by default for accessibility
  const allowFontScaling = props.allowFontScaling !== false;

  return (
    <Text
      style={[
        selectedVariantStyle,
        // fontWeightStyle, // fontWeight is now part of selectedVariantStyle
        { color: color ?? colors.text }, // Use theme text color by default
        style, // Apply custom styles last
      ]}
      allowFontScaling={allowFontScaling}
      {...props} // Pass down other Text props (accessibilityLabel, etc.)
    />
  );
}; 