import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { defaultStyles, Spacing } from '@/constants/Styles';

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
  noMarginBottom?: boolean;
  isElevated?: boolean;
}

const SettingsGroup: React.FC<SettingsGroupProps> = ({ title, children, noMarginBottom, isElevated }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    container: {
      marginBottom: noMarginBottom ? 0 : Spacing.lg,
      zIndex: isElevated ? 10 : 1,
    },
    groupHeader: {
      ...defaultStyles.textCaption,
      color: colors.secondary,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.sm,
      textTransform: 'uppercase',
    },
    groupContent: {
      backgroundColor: colors.card,
      borderRadius: 10,
      marginHorizontal: Spacing.md,
      borderWidth: StyleSheet.hairlineWidth, // Use hairline width for subtle border
      borderColor: colors.border,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.groupHeader}>{title}</Text>
      <View style={styles.groupContent}>
        {children}
      </View>
    </View>
  );
};

export default SettingsGroup; 