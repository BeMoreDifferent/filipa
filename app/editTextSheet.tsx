import React, { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  Platform,
  KeyboardAvoidingView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTextElementStore } from '../store/textElementStore';
import { TextElement } from '../types/textElement';
import { randomUUID } from 'expo-crypto';
import { t } from '@/config/i18n';
import { Spacing, BorderRadius, defaultStyles } from '@/constants/Styles';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLOR_PICKER_WIDTH = 56;

/**
 * EditTextSheet – keeps the original design untouched.
 * Fixes applied:
 *   • Title TextInput is now strictly single‑line.
 *   • Modal/background fully adopts the current theme colour via `contentStyle`.
 *   • Prompt textarea still flexes to use leftover space.
 */
const EditTextSheet = (): JSX.Element => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hydrate = useTextElementStore((s) => s.hydrate);
  const add = useTextElementStore((s) => s.add);
  const update = useTextElementStore((s) => s.update);
  const remove = useTextElementStore((s) => s.remove);
  const elements = useTextElementStore((s) => s.elements);
  const { theme, colors } = useTheme();
  const insets = useSafeAreaInsets();

  const labelColors = (Colors[theme]?.labels ?? Colors.light.labels) as string[];
  const colorOptions = [undefined, ...labelColors];

  const isEditing = Boolean(params.id);
  const initial = isEditing ? elements.find((e) => e.id === params.id) : undefined;
  const [title, setTitle] = useState<string>(initial?.title || '');
  const [color, setColor] = useState<string | undefined>(initial?.color);
  const [text, setText] = useState<string>(
    initial?.text || (typeof params.text === 'string' ? params.text : '')
  );

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (isEditing && initial) {
      setTitle(initial.title);
      setColor(initial.color || colorOptions[0]);
      setText(initial.text);
    }
  }, [elements, params.id]);

  const handleSave = async () => {
    const element: TextElement = {
      id: isEditing && initial ? initial.id : randomUUID(),
      title: title.trim(),
      text: text.trim(),
      color: color?.trim() || undefined,
    };
    if (isEditing && initial) {
      await update(element);
    } else {
      await add(element);
    }
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      t('common.delete', 'Delete'),
      t(
        'drawer.deleteChatConfirm',
        'Are you sure you want to delete the chat? This action cannot be undone.'
      ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (isEditing && initial) {
              await remove(initial.id);
              router.back();
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Spacing.xl}
      >
        <Stack.Screen
          options={{
            presentation: 'formSheet',
            contentStyle: { backgroundColor: colors.background }, // full‑sheet theme colour
            headerTransparent: true,
            headerTitle: isEditing
              ? t('editTextSheet.headerEditQuick', 'Edit Quick Prompt')
              : t('editTextSheet.headerCreateQuick', 'Add Quick Prompt'),
            headerTitleStyle: { color: colors.text },
            headerTintColor: colors.text,
            headerRight: () => (
              <Text
                style={[defaultStyles.textButton, { color: colors.primary, marginRight: Spacing.md }]}
                onPress={handleSave}
              >
                {t('common.save', 'Save')}
              </Text>
            ),
          }}
        />

        <View style={[styles.sheetContainer, { paddingTop: Spacing.md, flex: 1 }]}>
          {/* Title row */}
          <View style={styles.row}>
            <View style={styles.titleCol}>
              <TextInput
                style={[styles.input, { color: colors.text, height: 40, paddingVertical: 0, width: '100%' }]} // single‑line height
                placeholder={t(
                  'editTextSheet.titlePlaceholderQuick',
                  "Prompt name (e.g. 'Summarize', 'Translate to French')"
                )}
                value={title}
                onChangeText={setTitle}
                autoFocus
                placeholderTextColor={colors.disabledInputText}
                returnKeyType="done"
                numberOfLines={1}
                multiline={false}
              />
            </View>
            <View style={styles.colorCol} />
          </View>

          {/* Colour picker */}
          <View style={styles.inlineColorPickerRow}>
            {colorOptions.map((item) => (
              <TouchableOpacity key={item || 'none'} onPress={() => setColor(item)}>
                <View
                  style={[
                    styles.inlineSwatch,
                    {
                      backgroundColor: item || 'transparent',
                      borderColor: color === item ? colors.primary : colors.border,
                      borderWidth: color === item ? 3 : 1,
                    },
                    item === undefined && styles.noColorSwatch,
                  ]}
                >
                  {item === undefined && <Ionicons name="close" size={18} color={colors.icon} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Multiline prompt text */}
          <TextInput
            style={[defaultStyles.input, styles.textarea, { color: colors.text }]}
            multiline
            placeholder={t(
              'editTextSheet.textPlaceholderQuick',
              "Enter the prompt text (e.g. 'Summarize the following text:')"
            )}
            value={text}
            onChangeText={setText}
            textAlignVertical="top"
            placeholderTextColor={colors.disabledInputText}
          />

          <Text style={[styles.helperText, { color: colors.icon }]}> 
            {t(
              'editTextSheet.helperQuick',
              'Quick prompts let you instantly reuse common instructions or questions for the AI.'
            )}
          </Text>
        </View>

        {/* Delete button */}
        {isEditing && initial && (
          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: colors.error + '22' }]}
            onPress={handleDelete}
          >
            <Text style={[styles.deleteBtnText, { color: colors.error }]}> 
              {t('editTextSheet.deleteQuick', 'Delete this quick prompt')}
            </Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    justifyContent: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
  },
  titleCol: {
    flex: 1,
    
  },
  colorCol: {
    width: COLOR_PICKER_WIDTH,
    alignItems: 'center',
  },
  input: {
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  textarea: {
    flex: 1,
    minHeight: 120,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    borderTopWidth: 1,
    borderColor: Colors.grey[300],
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  inlineColorPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
    gap: Spacing.sm,
  },
  inlineSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noColorSwatch: {
    backgroundColor: Colors.grey[200],
    borderStyle: 'dashed',
  },
  deleteBtn: {
    margin: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.alert[100],
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: Colors.alert[500],
    fontWeight: 'bold',
    fontSize: 16,
  },
  helperText: {
    color: Colors.grey[600],
    fontSize: 13,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
});

export default EditTextSheet;
