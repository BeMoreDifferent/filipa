import React, { useCallback, useImperativeHandle, useRef, forwardRef } from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Spacing, Typography } from '@/constants/Styles';
import { useTheme } from '@/providers/ThemeProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    useAnimatedStyle,
    withTiming,
} from 'react-native-reanimated';
import McpToolSelectorButton from '@/components/settings/McpToolSelectorButton';

/**
 * Props for ChatInput (MessageInputBar).
 * @property {string} message - Current input value.
 * @property {(t: string) => void} setMessage - Setter for input value.
 * @property {() => void} onSendMessage - Callback to send message.
 * @property {boolean} isStreaming - Assistant streaming flag.
 */
export interface ChatInputProps {
    onSendMessage: (text: string) => void;
    isStreaming: boolean;
}

/**
 * Ref interface for ChatInput, exposes focus method.
 * @interface ChatInputRef
 * @method focus Focuses the input field
 */
export interface ChatInputRef {
    focus: () => void;
}

/**
 * Chat input bar with smooth animated feedback and reliable positioning.
 * Visual-only upgrade; core logic (input, send) untouched.
 * - Right slot seamlessly swaps 🎤 ↔ 🚀 ↔ ⏳ using Reanimated opacity/scale.
 * - Plus‑button & translucent pill retained.
 * - Keyboard spacer unchanged for smooth safe‑area behaviour.
 *
 * @param {ChatInputProps} props
 * @returns {React.ReactElement}
 */
const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
    ({ onSendMessage, isStreaming }, ref) => {
        const [message, setMessage] = React.useState('');
        const { colors } = useTheme();
        const { bottom: bottomInset } = useSafeAreaInsets();
        const inputRef = useRef<TextInput>(null);

        // Derived state helpers
        const hasText = message.trim().length > 0;

        // Animated icon styles
        const fadeTiming = { duration: 120 };

        const micIconStyle = useAnimatedStyle(() => ({
            opacity: withTiming(hasText || isStreaming ? 0 : 1, fadeTiming),
            transform: [
                { scale: withTiming(hasText || isStreaming ? 0.8 : 1, fadeTiming) },
            ],
        }));

        const sendIconStyle = useAnimatedStyle(() => ({
            opacity: withTiming(hasText && !isStreaming ? 1 : 0, fadeTiming),
            transform: [
                { scale: withTiming(hasText && !isStreaming ? 1 : 0.8, fadeTiming) },
            ],
        }));

        const spinnerStyle = useAnimatedStyle(() => ({
            opacity: withTiming(isStreaming ? 1 : 0, fadeTiming),
            transform: [
                { scale: withTiming(isStreaming ? 1 : 0.8, fadeTiming) },
            ],
        }));

        // Handlers
        const handleSend = useCallback(() => {
            if (!hasText || isStreaming) return;
            onSendMessage(message);
            setMessage('');
        }, [hasText, isStreaming, onSendMessage, message]);

        useImperativeHandle(ref, () => ({
            focus: () => {
                inputRef.current?.focus();
            },
        }), []);

        // Render
        const inputMinHeight = 44;

        return (
            <View
                style={[
                    styles.container,
                    Platform.OS === 'android' && { paddingBottom: bottomInset },
                ]}
            >
                <View
                    style={[
                        styles.pill,
                        {
                            minHeight: inputMinHeight,
                        },
                    ]}
                >
                    {/* Add / attachments icon */}
                    <McpToolSelectorButton disabled={isStreaming} />

                    {/* Text area */}
                    <TextInput
                        ref={inputRef}
                        style={[
                            styles.input,
                            {
                                color: colors.text,
                                ...Platform.select({ ios: { top: 1 }, android: { marginTop: -2 } }),
                            },
                        ]}
                        value={message}
                        onChangeText={setMessage}
                        placeholder="What's on your mind…"
                        placeholderTextColor={colors.icon}
                        multiline
                        editable={!isStreaming}
                        accessibilityLabel="Message input"
                        accessibilityHint="Type your message here"
                    />

                    {/* Right‑slot icon container */}
                    <TouchableOpacity
                        onPress={handleSend}
                        accessibilityRole="button"
                        accessibilityLabel={hasText ? 'Send message' : 'Voice input (not implemented)'}
                        accessibilityState={{ disabled: !hasText || isStreaming }}
                        disabled={!hasText || isStreaming}
                        style={styles.iconTouch}
                    >
                        {/* 🎤 */}
                        {/* <Animated.View style={[StyleSheet.absoluteFill, styles.center, micIconStyle]}>
                            <Ionicons name="mic-outline" size={20} color={colors.icon}/>
                        </Animated.View> */}
                        {/* 🚀 */}
                        <Animated.View style={[StyleSheet.absoluteFill, styles.center, sendIconStyle]}>
                            <Ionicons name="send" size={18} color={colors.primary} />
                        </Animated.View>
                        {/* ⏳ */}
                        <Animated.View style={[StyleSheet.absoluteFill, styles.center, spinnerStyle]}>
                            <ActivityIndicator size="small" />
                        </Animated.View>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }
);

ChatInput.displayName = 'ChatInput';

const styles = StyleSheet.create({
    container: {

       
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
    },
    input: {
        flex: 1,
        minHeight: 34,
        maxHeight: 120,
        paddingHorizontal: 0,
        paddingVertical: Spacing.sm,
        ...Typography.material.body1Object,
        ...Typography.systemWeights.light,
    },
    iconTouch: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 36,
        height: 36,
    },
    center: { justifyContent: 'center', alignItems: 'center' },
});

export default ChatInput; 