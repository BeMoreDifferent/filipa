import { Colors } from '@/constants/Colors';
import { StyleSheet, Platform } from 'react-native';
import {
  material, // Using Material Design styles as a base
  materialColors,
  systemWeights, // For cross-platform consistent weights
  // human, humanDense, humanTall, etc. could also be imported if needed
} from 'react-native-typography';

// --- Spacing ---
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// --- Borders ---
export const BorderRadius = {
  xs: 2,
  sm: 4,
  md: 10,
  lg: 15,
  xl: 20,
};

// --- Component Specific Dimensions ---
/**
 * Base height for the ChatHeader's content area, including its fixed vertical paddings
 * but excluding the top safe area inset.
 * Calculation: Spacing.sm (for the non-inset part of top padding) + 28 (typical icon height) + Spacing.sm (bottom padding).
 * To get the full typical ChatHeader height in a component, add `insets.top` (from `useSafeAreaInsets()`) to this value.
 * Example: 8 (Spacing.sm) + 28 (icon) + 8 (Spacing.sm) = 44.
 */
export const ChatHeaderBaseHeight = Spacing.sm + 28 + Spacing.sm;

// --- Typography ---
// Removed previous FontSize, LineHeight, Fonts, baseFontSize, fontScale
// We now use styles directly from react-native-typography


// --- Reusable Default Styles ---
// Note: Colors are applied via ThemeProvider, not hardcoded here usually,
// but react-native-typography includes default colors we might override later.
export const defaultStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
  },
  pageContainer: { // Style for a full screen page container
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  textBody: {
    ...material.body1Object, // Use material body1 style object
    ...systemWeights.light, // Make default body text lighter for an elegant feel
    // color: Colors.text, // Example: Override color from theme
  },
  textHeading: { // Base style for largest heading (h1 equivalent)
    ...material.display1Object, // Using display1 for large headings
    ...systemWeights.bold, // Ensure bold weight consistently
    marginBottom: Spacing.md,
    // color: Colors.text, // Example: Override color
  },
  textSubheading: { // Base style for h2/h3 equivalent
    ...material.headlineObject, // Using headline for subheadings
    ...systemWeights.semibold, // Ensure semibold weight consistently
    marginBottom: Spacing.sm,
    // color: Colors.text, // Example: Override color
  },
  textCaption: {
    ...material.captionObject,
    // color: Colors.textMuted, // Example: Override color
  },
  textInput: { // Generic text input style
    ...material.subheadingObject, // Or material.body1Object depending on desired size
    borderWidth: StyleSheet.hairlineWidth, // Minimal border
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm, // Adjust for consistent height with buttons
    minHeight: 44, // Standard touch target height
    // backgroundColor: Colors.inputBackground, // Applied via theme
    // color: Colors.text, // Applied via theme
    // placeholderTextColor: Colors.secondary, // Applied via theme
  },
  textButton: { // Style for text that acts as a button
    ...material.buttonObject,
    ...systemWeights.regular,
    // color: Colors.primary, // Applied via theme
  },
  // Update base styles for buttons, inputs etc. using the library
  button: {
    // Keep layout styles
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm, // Adjusted to match material potentially
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    // Background color would come from theme/props
  },
  buttonText: {
    ...material.buttonObject, // Use material button text style
    ...systemWeights.semibold, // Often buttons use a bolder weight
    // color: Colors.primary, // Example: Override color
  },
  input: {
    // Keep layout/border styles
    borderWidth: 1,
    borderRadius: BorderRadius.sm, // Adjusted to match material potentially
    padding: Spacing.sm,
    minHeight: 44,
    // Apply text styles from the library
    ...material.subheadingObject, // Use subheading or body1 for input text
    // color: Colors.text, // Example: Override color
    // placeholderTextColor: Colors.textMuted, // Example
  },
  btn: { // Assuming this is another button style
    height: 50,
    borderRadius: BorderRadius.lg, // Example: larger radius
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: Spacing.md, // Example: more padding
    // backgroundColor: Colors.primary, // Example
  },
  // btnText could be defined here if needed, similar to buttonText
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

// Export typography constants if needed elsewhere, e.g., for direct use
export const Typography = {
  material,
  // human, // uncomment if imported and needed
  systemWeights,
};

export const PlatformColors = { // Export colors if needed
  material: materialColors,
  // ios: iOSColors, // uncomment if imported and needed
};
