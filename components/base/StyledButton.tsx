import React from 'react';
import { Pressable, PressableProps, StyleSheet, TextProps, View, ViewStyle } from 'react-native'; // Import View, ViewStyle
import { useTheme } from '@/providers/ThemeProvider';
import { defaultStyles, Spacing } from '@/constants/Styles'; // Import Spacing
import { StyledText } from './StyledText'; // Use StyledText for button label
import { readableText, adjustColor } from '../../utils/colorHelpers';

interface StyledButtonProps extends PressableProps {
  title?: string; // Optional title for simple buttons
  children?: React.ReactNode; // Children override title/icon
  icon?: React.ReactNode; // Icon element
  iconPosition?: 'left' | 'right'; // Icon position relative to text
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost'; // Added 'ghost'
  textStyle?: TextProps['style']; // Use TextProps for textStyle type
  accessibilityLabel?: string; // Destructure accessibilityLabel
  color?: string; // Custom background/border color
  textColor?: string; // Custom text color
}

/**
 * A base Button component (using Pressable) that applies theme colors,
 * base styles, and accessibility props.
 * Supports variants like primary, secondary, outline, destructive, ghost.
 * Can include a title, an icon, both, or custom children.
 * Custom children override title and icon props.
 * Accessibility Label is recommended if no title or textual children are provided.
 */
export const StyledButton = ({
  title,
  children,
  icon,
  iconPosition = 'left', // Default icon position
  variant = 'primary',
  style,
  textStyle,
  disabled, // Destructure disabled prop
  accessibilityLabel, // Destructure accessibilityLabel
  color, // Custom color
  textColor, // Custom text color
  ...props
}: StyledButtonProps) => {
  const { colors } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          button: { backgroundColor: color || colors.secondary },
          text: { color: textColor || colors.background },
        };
      case 'outline':
        return {
          button: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color || colors.primary },
          text: { color: textColor || color || colors.primary },
        };
      case 'destructive':
        return {
          button: { backgroundColor: color || colors.error },
          text: { color: textColor || colors.background },
        };
      case 'ghost': // Styles for ghost variant
        return {
          button: { backgroundColor: 'transparent' },
          text: { color: textColor || colors.primary },
        };
      case 'primary':
      default:
        return {
          button: { backgroundColor: color || colors.primary },
          text: { color: textColor || colors.background }, // Assuming primary bg is dark enough
        };
    }
  };

  const variantStyles = getVariantStyles();

  // Apply disabled styles
  const disabledStyle = disabled ? { opacity: 0.5 } : {};
  const base = color ??
    (variant === 'destructive'
      ? colors.error
      : variant === 'secondary'
        ? colors.secondary
        : colors.primary);
  const fg = textColor ?? readableText(base);
  const borderColor = variant === 'outline' ? base : adjustColor(base, -15);

  // Determine button content
  const content = children ?? (
    <View style={styles.contentContainer}>
      {icon && iconPosition === 'left' && (
        <View style={title ? styles.iconWrapperLeft : styles.iconWrapper}>{icon}</View>
      )}
      {title && (
        <StyledText variant="button" style={[defaultStyles.buttonText, variantStyles.text, textStyle]}>
          {title}
        </StyledText>
      )}
      {icon && iconPosition === 'right' && (
        <View style={title ? styles.iconWrapperRight : styles.iconWrapper}>{icon}</View>
      )}
    </View>
  );

  // Warn if no accessible label is provided for icon-only or non-text children
  if (!title && !children && !accessibilityLabel) {
    console.warn(
      'Warning: StyledButton without a title or textual children should have an accessibilityLabel for screen readers.'
    );
  }

  return (
    <Pressable
      style={(state) => {
        // Resolve the incoming style prop if it's a function
        const resolvedStyle = typeof style === 'function' ? style(state) : style;

        return [
          defaultStyles.button, // Base button styles
          variantStyles.button, // Variant background/border
          { opacity: state.pressed && !disabled ? 0.7 : 1 }, // Use state.pressed
          disabledStyle, // Apply disabled opacity
          resolvedStyle, // Use the resolved custom styles
          { borderColor: borderColor, borderWidth: 1 },
        ];
      }}
      accessibilityRole="button" // Accessibility
      accessibilityState={{ disabled: !!disabled }} // Set accessibility state
      accessibilityLabel={accessibilityLabel ?? title} // Prioritize provided accessibilityLabel, otherwise use title if available
      disabled={disabled} // Pass disabled prop to Pressable
      {...props}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
  },
  iconWrapper: {
    // No margin needed if it's alone
  },
  iconWrapperLeft: {
    marginRight: Spacing.sm, // Use spacing constant
  },
  iconWrapperRight: {
    marginLeft: Spacing.sm, // Use spacing constant
  },
}); 