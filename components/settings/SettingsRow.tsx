import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { defaultStyles, Spacing } from '@/constants/Styles';

interface SettingsRowProps {
  label: string | React.ReactNode;
  children: React.ReactNode;
  isLast?: boolean;
  minHeight?: number;
  onPress?: () => void;
  isButton?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ label, children, isLast, minHeight = 44, onPress, isButton }) => {
  const { colors } = useTheme();

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      minHeight: minHeight, // Use prop for minHeight
      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      ...defaultStyles.textBody,
      color: colors.text,
      flexGrow: 0,
      flexShrink: 1,
      marginRight: Spacing.md,
    },
    rowContent: {
      flexGrow: 1,
      alignItems: 'flex-end',
    },
  });

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress && !isButton}>
      {typeof label === 'string' ? (
        <Text style={styles.rowLabel}>{label}</Text>
      ) : (
        <View style={{ flex: 1, marginRight: Spacing.sm }}>{label}</View>
      )}
      <View style={styles.rowContent}>
         {children}
      </View>
    </TouchableOpacity>
  );
};

export default SettingsRow; 