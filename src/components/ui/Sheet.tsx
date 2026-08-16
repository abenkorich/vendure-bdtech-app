import {useEffect} from 'react';
import {Modal, Pressable, View, useWindowDimensions} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text} from './Text';
import {IconSymbol} from './IconSymbol';
import {Divider} from './Divider';

/**
 * Bottom sheet — filters, sort, variant selection.
 *
 * Built on `Modal` rather than a portal so it inherits the platform's back
 * button and accessibility focus trapping for free, with a spring-driven
 * translate on top. Dragging past a third of its height dismisses; anything
 * less springs back, so a hesitant drag never loses the user's context.
 *
 * The drag axis is vertical only, which is why this component needs no RTL
 * handling of its own — but its *content* does.
 */

export interface SheetProps {
    open: boolean;
    onClose: () => void;
    /** Sheet title, rendered in a header row with a close button. */
    title?: string;
    /**
     * Fraction of screen height the sheet occupies, 0–1. Defaults to content
     * height, capped at 0.9 so the screen underneath is always visible.
     */
    height?: number;
    children?: React.ReactNode;
}

export function Sheet({open, onClose, title, height, children}: SheetProps) {
    const {theme} = useUnistyles();
    const {height: screenHeight} = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const translateY = useSharedValue(screenHeight);
    const backdrop = useSharedValue(0);

    useEffect(() => {
        if (open) {
            translateY.value = withSpring(0, theme.motion.spring);
            backdrop.value = withTiming(1, {duration: theme.motion.base});
        } else {
            translateY.value = withTiming(screenHeight, {duration: theme.motion.fast});
            backdrop.value = withTiming(0, {duration: theme.motion.fast});
        }
    }, [open, screenHeight, translateY, backdrop, theme.motion]);

    const pan = Gesture.Pan()
        .onChange(event => {
            // Downward only: dragging up must not detach the sheet from the
            // bottom edge, which would look like a rendering bug.
            translateY.value = Math.max(0, translateY.value + event.changeY);
        })
        .onEnd(event => {
            const shouldClose =
                translateY.value > screenHeight * 0.18 || event.velocityY > 800;
            if (shouldClose) {
                translateY.value = withTiming(screenHeight, {duration: theme.motion.fast});
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0, theme.motion.spring);
            }
        });

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{translateY: translateY.value}],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdrop.value,
    }));

    return (
        <Modal
            visible={open}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.root}>
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <Pressable
                        style={styles.backdropPress}
                        accessibilityLabel="Close"
                        accessibilityRole="button"
                        onPress={onClose}
                    />
                </Animated.View>

                <Animated.View
                    style={[
                        styles.sheet,
                        {paddingBottom: insets.bottom + theme.spacing.lg},
                        height ? {height: screenHeight * Math.min(height, 0.9)} : undefined,
                        sheetStyle,
                    ]}
                >
                    <GestureDetector gesture={pan}>
                        <View style={styles.grabArea}>
                            <View style={styles.grabber} />
                        </View>
                    </GestureDetector>

                    {title ? (
                        <>
                            <View style={styles.header}>
                                <Text variant="heading" numberOfLines={1} style={styles.headerTitle}>
                                    {title}
                                </Text>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel="Close"
                                    onPress={onClose}
                                    hitSlop={12}
                                    style={styles.close}
                                >
                                    <IconSymbol name="close" size={20} color="textMuted" />
                                </Pressable>
                            </View>
                            <Divider />
                        </>
                    ) : null}

                    <View style={styles.content}>{children}</View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    backdropPress: {
        flex: 1,
    },
    sheet: {
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        borderWidth: theme.elevation.sheet.borderWidth,
        borderBottomWidth: theme.elevation.sheet.borderBottomWidth,
        borderColor: theme.colors.border,
        maxHeight: '90%',
    },
    grabArea: {
        // 44pt of grabbable area for a 4pt visual handle: the handle is a hint,
        // the target has to be a real one.
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    grabber: {
        width: 36,
        height: 4,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.border,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
    },
    headerTitle: {
        flex: 1,
    },
    close: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        flexShrink: 1,
    },
}));
