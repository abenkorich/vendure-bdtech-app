import {useEffect} from 'react';
import {View, type DimensionValue, type ViewStyle, type StyleProp} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    interpolate,
} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

/**
 * Skeleton placeholder.
 *
 * A **pulse**, not a sweeping shimmer gradient: a gradient needs an extra
 * native dependency and, more importantly, a moving highlight across a grid of
 * cards is decoration competing with the content that is about to arrive.
 *
 * The most dangerous failure this app can ship is a screen that renders
 * skeletons forever because a query key never resolves, so a skeleton must
 * always be visibly *animating* — a static grey box is indistinguishable from
 * a broken layout.
 */

export interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    /** Corner radius token. Defaults to `sm`. Use `full` for avatars. */
    radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
    style?: StyleProp<ViewStyle>;
}

export function Skeleton({width = '100%', height = 16, radius = 'sm', style}: SkeletonProps) {
    const {theme} = useUnistyles();
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, {duration: theme.motion.slow * 3, easing: Easing.inOut(Easing.quad)}),
            -1,
            true,
        );
    }, [progress, theme.motion.slow]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(progress.value, [0, 1], [0.45, 1]),
    }));

    return (
        <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
                styles.skeleton,
                {width, height, borderRadius: theme.radius[radius]},
                animatedStyle,
                style,
            ]}
        />
    );
}

/**
 * Vertical stack of text-line skeletons, with a short last line so the block
 * reads as a paragraph rather than a solid slab.
 */
export function SkeletonText({lines = 3, width = '100%'}: {lines?: number; width?: DimensionValue}) {
    return (
        <View style={styles.stack}>
            {Array.from({length: lines}, (_, index) => (
                <Skeleton
                    key={index}
                    height={12}
                    width={index === lines - 1 ? '60%' : width}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    skeleton: {
        backgroundColor: theme.colors.skeleton,
    },
    stack: {
        gap: theme.spacing.sm,
        alignSelf: 'stretch',
    },
}));
