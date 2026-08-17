import {useEffect} from 'react';
import {Pressable, View} from 'react-native';
import Animated, {FadeInDown, FadeOutDown} from 'react-native-reanimated';
import {StyleSheet} from 'react-native-unistyles';
import {Text, IconSymbol} from '@/components/ui';

/**
 * Undo snackbar for a removed line.
 *
 * Removal is immediate and optimistic — asking "are you sure?" for something
 * this cheap to reverse costs every customer a tap to protect the few who
 * misfired. The undo window is the safety net instead.
 *
 * Enter/exit stay under the motion budget; the bar sits above the sticky CTA
 * so it never covers the checkout button.
 */

export interface UndoBarProps {
    visible: boolean;
    message: string;
    actionLabel: string;
    onAction: () => void;
    onExpire: () => void;
    /** Milliseconds before the bar retires itself. */
    duration?: number;
}

export function UndoBar({
    visible,
    message,
    actionLabel,
    onAction,
    onExpire,
    duration = 5000,
}: UndoBarProps) {
    useEffect(() => {
        if (!visible) return;
        const timer = setTimeout(onExpire, duration);
        return () => clearTimeout(timer);
    }, [visible, duration, onExpire, message]);

    if (!visible) return null;

    return (
        <Animated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(140)}
            style={styles.root}
            accessibilityLiveRegion="polite"
        >
            <View style={styles.content}>
                <IconSymbol name="trash" size={16} color="textMuted" />
                <Text variant="caption" numberOfLines={1} style={styles.message}>
                    {message}
                </Text>
            </View>

            <Pressable
                accessibilityRole="button"
                accessibilityLabel={actionLabel}
                onPress={onAction}
                hitSlop={12}
            >
                <Text variant="bodyStrong" color="brand">
                    {actionLabel}
                </Text>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        // Elevation is tint plus a hairline, never a shadow.
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        marginHorizontal: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        flexShrink: 1,
    },
    message: {flexShrink: 1},
}));
