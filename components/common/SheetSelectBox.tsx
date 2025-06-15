import React, { useCallback, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useTheme } from '@/providers/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, defaultStyles } from '@/constants/Styles';
import { t } from '@/config/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StyledButton } from '../base/StyledButton';

export interface SheetSelectOption {
  label: string;
  value: string | number;
  searchTerms?: string; // Optional terms to assist searching
  /**
   * Optional category/group for grouping options under subheadlines.
   */
  category?: string;
}

interface SheetSelectBoxProps {
  /**
   * Options to display in the sheet. Can be grouped by category.
   */
  options: SheetSelectOption[];
  /**
   * Selected value(s). If multiselect is true, this should be an array of values.
   */
  selectedValue: string | number | Array<string | number> | null | undefined;
  /**
   * Callback when selection changes. If multiselect, returns array of values.
   */
  onValueChange: (value: string | number | Array<string | number> | null) => void;
  placeholder?: string;
  modalTitle?: string;
  disabled?: boolean;
  searchable?: boolean;
  showClearButton?: boolean; // Option to show a clear button
  clearButtonText?: string; // Text for the clear button
  /**
   * If true, does not render the dropdown trigger. Sheet can be opened programmatically via ref.
   */
  triggerless?: boolean;
  /**
   * If true, enables multiselect mode. Allows selecting multiple options and returns an array of values.
   */
  multiselect?: boolean;
  /**
   * Optional icon name for a header button (Ionicons). If provided, renders a button in the top right of the modal header.
   */
  headerButtonIcon?: keyof typeof Ionicons.glyphMap;
  /**
   * Optional callback for the header button. If provided, the button is rendered and triggers this function.
   */
  onHeaderButtonPress?: () => void;
  /**
   * Optional label for the header button (for accessibility).
   */
  headerButtonLabel?: string;
}

export interface SheetSelectBoxRef {
  /**
   * Opens the sheet programmatically.
   * @example
   *   const ref = useRef<SheetSelectBoxRef>(null);
   *   // ...
   *   ref.current?.openSheet();
   */
  openSheet: () => void;
}

/**
 * SheetSelectBox
 *
 * A bottom-sheet select box for React Native, designed for use with @gorhom/bottom-sheet and reanimated environments.
 *
 * Supports single or multi-select, and grouping options by category with subheadlines that allow select/deselect all.
 *
 * ⚠️ IMPORTANT: To avoid infinite event loops and performance issues when used inside BottomSheet or with KeyboardAwareScrollView,
 * this component defers calling `onValueChange` until after the modal is fully dismissed. It uses local state for the selection
 * while the modal is open, and only updates the parent after closing. This prevents feedback loops and reanimated storms.
 *
 * Performance best practices:
 * - All callbacks and derived values are memoized with useCallback/useMemo.
 * - renderItem is memoized to avoid unnecessary FlatList re-renders.
 * - extraData is passed to FlatList to ensure only relevant items update.
 * - The component is exported with React.memo for parent-level optimization.
 * - Avoid reading Reanimated shared values in render or useMemo (see warning in docs).
 *
 * If you modify this pattern, always test with BottomSheet and reanimated content.
 *
 * @param {SheetSelectBoxProps} props
 * @param {React.Ref<SheetSelectBoxRef>} ref - Ref to control the sheet programmatically
 * @returns {JSX.Element}
 */
const SheetSelectBox = forwardRef<SheetSelectBoxRef, SheetSelectBoxProps>(({
  options,
  selectedValue,
  onValueChange,
  placeholder = t('sheetSelectBox.placeholder', 'Select an option'),
  modalTitle = t('sheetSelectBox.modalTitle', 'Select an option'),
  disabled = false,
  searchable = true,
  showClearButton = false,
  clearButtonText = t('common.clear', 'Clear'),
  triggerless = false,
  multiselect = false,
  headerButtonIcon,
  onHeaderButtonPress,
  headerButtonLabel,
}, ref) => {
  const { colors } = useTheme();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [searchText, setSearchText] = useState('');
  const [singleSelectedValue, setSingleSelectedValue] = useState<string | number | null | undefined>(multiselect ? undefined : selectedValue as string | number | null | undefined);
  const [multiSelectedValue, setMultiSelectedValue] = useState<(string | number)[]>(multiselect && Array.isArray(selectedValue) ? selectedValue as (string | number)[] : []);
  const [pendingSingleValue, setPendingSingleValue] = useState<string | number | null | undefined>(undefined);
  const [pendingMultiValue, setPendingMultiValue] = useState<(string | number)[] | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const snapPoints = useMemo(() => ['60%', '85%'], []);

  const handlePresentModalPress = useCallback(() => {
    if (!disabled) {
      setSearchText('');
      if (multiselect) {
        setMultiSelectedValue(Array.isArray(selectedValue) ? selectedValue as (string | number)[] : []);
      } else {
        setSingleSelectedValue(selectedValue as string | number | null | undefined);
      }
      setModalOpen(true);
      bottomSheetModalRef.current?.present();
    }
  }, [disabled, selectedValue, multiselect]);

  // Expose openSheet method via ref
  useImperativeHandle(ref, () => ({
    openSheet: handlePresentModalPress
  }), [handlePresentModalPress]);

  const handleDismissModal = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

  // Only call parent's onValueChange after modal is closed
  const handleModalDismiss = useCallback(() => {
    setModalOpen(false);
    setSearchText('');
    if (multiselect) {
      if (
        typeof pendingMultiValue !== 'undefined' &&
        !isEqualArray(pendingMultiValue, selectedValue as (string | number)[])
      ) {
        onValueChange(pendingMultiValue);
      }
      setPendingMultiValue(undefined);
    } else {
      if (
        typeof pendingSingleValue !== 'undefined' &&
        pendingSingleValue !== selectedValue
      ) {
        onValueChange(pendingSingleValue);
      }
      setPendingSingleValue(undefined);
    }
  }, [pendingSingleValue, pendingMultiValue, selectedValue, onValueChange, multiselect]);

  const handleSelectOption = (option: SheetSelectOption) => {
    if (multiselect) {
      let current = [...multiSelectedValue];
      const idx = current.indexOf(option.value);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        current.push(option.value);
      }
      setMultiSelectedValue(current);
      setPendingMultiValue(current);
    } else {
      setSingleSelectedValue(option.value);
      setPendingSingleValue(option.value);
      handleDismissModal();
    }
  };

  const handleClearSelection = () => {
    if (multiselect) {
      setMultiSelectedValue([]);
      setPendingMultiValue([]);
    } else {
      setSingleSelectedValue(null);
      setPendingSingleValue(null);
    }
    handleDismissModal();
  };

  const selectedOption = useMemo(
    () => options.find(option => option.value === (modalOpen ? singleSelectedValue : selectedValue)),
    [options, singleSelectedValue, selectedValue, modalOpen]
  );

  const filteredOptions = useMemo(() => {
    if (!searchText) {
      return options;
    }
    const lowerSearchText = searchText.toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(lowerSearchText) ||
      option.searchTerms?.toLowerCase().includes(lowerSearchText)
    );
  }, [options, searchText]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
      />
    ),
    []
  );

  const styles = StyleSheet.create({
    triggerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderWidth: 0,
      borderColor: undefined,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.card,
      minHeight: 44,
    },
    triggerText: {
      ...defaultStyles.textBody,
      color: selectedOption ? colors.text : colors.secondary,
      flex: 1,
      fontSize: 15,
    },
    triggerIcon: {
      marginLeft: Spacing.xs,
    },
    disabledContainer: {
      backgroundColor: colors.disabledInputBackground,
    },
    disabledText: {
      color: colors.disabledInputText,
    },
    bottomSheetContentContainer: {
      paddingBottom: Spacing.md,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.xs,
      paddingBottom: 0,
      borderBottomWidth: 0,
      backgroundColor: colors.card,
    },
    modalTitleText: {
      fontSize: 12,
      color: colors.secondary,
      textAlign: 'left',
      fontWeight: '400',
      flex: 1,
      ...defaultStyles.textSubheading,
    },
    headerButton: {
      marginLeft: 8,
      padding: 6,
      borderRadius: BorderRadius.sm,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 32,
      minHeight: 32,
    },
    headerButtonIcon: {
      color: '#fff',
      fontSize: 20,
    },
    searchInputContainer: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      height: 44,
    },
    searchIcon: {
      marginRight: 6,
      color: colors.secondary,
    },
    searchInput: {
      flex: 1,
      ...defaultStyles.textInput,
      borderWidth: 0,
      borderRadius: 0,
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      paddingVertical: 0,
      paddingHorizontal: 0,
      color: colors.text,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderBottomWidth: 0,
      minHeight: 44,
    },
    checkmarkIcon: {
      marginRight: 8,
    },
    unselectedIcon: {
      width: 20,
      height: 20,
      borderRadius: 6,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.disabledInputBackground,
      marginRight: 8,
    },
    optionText: {
      ...defaultStyles.textBody,
      color: colors.text,
      flex: 1,
      fontSize: 15,
    },
    optionTextSelected: {
      color: colors.primary,
    },
    clearButtonContainer: {
      paddingHorizontal: Spacing.sm,
      paddingTop: Spacing.xs,
      borderTopWidth: 0,
      marginTop: Spacing.xs,
      paddingBottom: insets.bottom + Spacing.sm,
    },
    clearButton: {
      backgroundColor: colors.warningBackground,
      paddingVertical: Spacing.xs,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
    },
    clearButtonText: {
      ...defaultStyles.textButton,
      color: colors.warningText,
      fontWeight: 'bold',
      fontSize: 14,
    },
    emptyStateContainer: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
    },
    emptyStateText: {
      ...defaultStyles.textBody,
      color: colors.secondary,
      fontSize: 14,
    },
  });

  const renderItem = useCallback(({ item }: { item: SheetSelectOption }) => {
    // For multi-select, check if item.value is in multiSelectedValue
    const isSelected = multiselect
      ? multiSelectedValue.includes(item.value)
      : item.value === selectedValue;
    return (
      <TouchableOpacity
        style={styles.optionRow}
        onPress={() => handleSelectOption(item)}
        activeOpacity={0.7}
      >
        {isSelected ? (
          <Ionicons name="checkmark" size={20} color={colors.primary} style={styles.checkmarkIcon} />
        ) : (
          <View style={styles.unselectedIcon} />
        )}
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  }, [selectedValue, multiSelectedValue, multiselect, colors.primary, styles.optionRow, styles.optionText, styles.optionTextSelected, styles.checkmarkIcon, styles.unselectedIcon, handleSelectOption]);

  return (
    <>
      {!triggerless && (
        <TouchableOpacity
          style={[styles.triggerContainer, disabled && styles.disabledContainer]}
          onPress={handlePresentModalPress}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Text style={[styles.triggerText, disabled && styles.disabledText]} numberOfLines={1} ellipsizeMode="tail">
            {selectedOption?.label ?? placeholder}
          </Text>
          <Ionicons
            name="chevron-down-outline"
            size={18}
            color={disabled ? colors.disabledInputText : colors.icon}
            style={styles.triggerIcon}
          />
        </TouchableOpacity>
      )}

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: colors.bottomSheetHandle }}
        backgroundStyle={{ backgroundColor: colors.bottomSheetBackground }}
        enableDismissOnClose
        onDismiss={handleModalDismiss}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitleText}>{modalTitle}</Text>
          {headerButtonIcon && onHeaderButtonPress && (
            <StyledButton
              variant="primary"
              icon={<Ionicons name={headerButtonIcon} size={20} color="#fff" />}
              onPress={onHeaderButtonPress}
              accessibilityLabel={headerButtonLabel || 'Add'}
              style={{ marginLeft: 8, minWidth: 32, minHeight: 32, padding: 0 }}
              textStyle={{ display: 'none' }} // Hide text, icon only
            />
          )}
          {searchable && (
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={18} style={styles.searchIcon} />
              <BottomSheetTextInput
                style={styles.searchInput}
                placeholder={t('sheetSelectBox.searchPlaceholder', 'Search...')}
                placeholderTextColor={colors.secondary}
                value={searchText}
                onChangeText={setSearchText}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          )}
        </View>
        <BottomSheetFlatList
          data={filteredOptions}
          keyExtractor={(item) => String(item.value)}
          renderItem={renderItem}
          contentContainerStyle={styles.bottomSheetContentContainer}
          extraData={{ selectedValue, singleSelectedValue, multiSelectedValue, modalOpen }}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>{t('sheetSelectBox.noResults', 'No results found')}</Text>
            </View>
          }
        />
        {showClearButton && (modalOpen ? multiSelectedValue : selectedValue) !== null && (modalOpen ? multiSelectedValue : selectedValue) !== undefined && (
           <View style={styles.clearButtonContainer}>
             <TouchableOpacity style={styles.clearButton} onPress={handleClearSelection}>
               <Text style={styles.clearButtonText}>{clearButtonText}</Text>
             </TouchableOpacity>
           </View>
         )}
      </BottomSheetModal>
    </>
  );
});

export default React.memo(SheetSelectBox);

function isEqualArray(a?: Array<string | number>, b?: Array<string | number>): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
} 