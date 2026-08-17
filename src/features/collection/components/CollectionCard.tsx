import {View, Pressable} from 'react-native';
import {Image} from 'expo-image';
import {LinearGradient} from 'expo-linear-gradient';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text, IconSymbol} from '@/components/ui';

/**
 * A collection as a photograph with its name over it.
 *
 * The shop tab used to be a text accordion, which asked a shopper to read
 * eleven near-identical rows to find "the one with the sensors in it". A photo
 * answers that in a glance, and this catalogue supplies one for every
 * top-level collection (verified: 7/7).
 *
 * Two details the picture makes necessary:
 *
 * - A **gradient scrim**, not a flat overlay. Product photography here ranges
 *   from dark workbenches to white sweeps, and white text is unreadable over
 *   the pale ones. A gradient keeps the top of the image clear while
 *   guaranteeing contrast where the label sits.
 * - **Press feedback by scale**, because a large image tile gives no other
 *   signal that it is a button.
 */

export interface CollectionCardProps {
    name: string;
    imageUrl?: string | null;
    /** Rendered as a subtitle: sub-collection count, product count, whatever fits. */
    meta?: string;
    /** `hero` is full width, `tile` is a half-width grid cell. */
    size?: 'hero' | 'tile';
    onPress: () => void;
}

export function CollectionCard({
    name,
    imageUrl,
    meta,
    size = 'tile',
    onPress,
}: CollectionCardProps) {
    const {theme} = useUnistyles();
    const pressed = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{scale: withSpring(1 - pressed.value * 0.02, theme.motion.spring)}],
    }));

    styles.useVariants({size});

    return (
        <Animated.View style={[styles.root, animatedStyle]}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={meta ? `${name}, ${meta}` : name}
                onPress={onPress}
                onPressIn={() => {
                    pressed.value = 1;
                }}
                onPressOut={() => {
                    pressed.value = 0;
                }}
                style={styles.pressable}
            >
                {imageUrl ? (
                    <Image
                        source={{uri: imageUrl}}
                        style={styles.image}
                        contentFit="cover"
                        transition={180}
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <IconSymbol name="chip" size={28} color="textMuted" />
                    </View>
                )}

                <LinearGradient
                    // Transparent at the top so the photograph is not muddied,
                    // opaque at the bottom so the label always has contrast.
                    colors={[
                        'transparent',
                        'rgba(0,0,0,0.30)',
                        'rgba(0,0,0,0.72)',
                        'rgba(0,0,0,0.90)',
                    ]}
                    locations={[0, 0.35, 0.72, 1]}
                    style={styles.scrim}
                />

                <View style={styles.caption}>
                    <Text
                        variant={size === 'hero' ? 'heading' : 'bodyStrong'}
                        numberOfLines={2}
                        style={styles.name}
                    >
                        {name}
                    </Text>
                    {meta ? (
                        <Text variant="micro" style={styles.meta} numberOfLines={1}>
                            {meta}
                        </Text>
                    ) : null}
                </View>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        backgroundColor: theme.colors.surfaceElevated,
        variants: {
            size: {
                hero: {height: 168},
                tile: {flex: 1, height: 132},
            },
        },
    },
    pressable: {
        flex: 1,
    },
    image: {
        ...StyleSheet.absoluteFillObject,
    },
    placeholder: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
    },
    caption: {
        position: 'absolute',
        bottom: 0,
        start: 0,
        end: 0,
        padding: theme.spacing.md,
        gap: 2,
    },
    // Always light: the scrim guarantees a dark backdrop in both themes.
    name: {
        color: '#ffffff',
        // Belt and braces over the gradient: some photos have a bright
        // highlight exactly where the label lands.
        textShadowColor: 'rgba(0,0,0,0.55)',
        textShadowOffset: {width: 0, height: 1},
        textShadowRadius: 4,
    },
    meta: {color: 'rgba(255,255,255,0.82)'},
}));
