import {useEffect, useRef} from 'react';
import {View, type ColorValue} from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import {StyleSheet} from 'react-native-unistyles';
import {IconSymbol, Text} from '@/components/ui';
import {useActiveOrder} from '@/features/cart/queries';
import {cartCount} from '@/lib/cart-math';

/**
 * The cart tab's icon: a live count, and a kick when something lands in it.
 *
 * The kick is the whole point. An item added from a rail or a grid leaves the
 * card the moment it is tapped and there is otherwise nothing to say where it
 * went; the icon jumping draws the eye to the place it went to. It fires on
 * any increase, wherever it came from, because it watches the cart rather
 * than the button.
 *
 * It deliberately does *not* fire for the count that arrives on launch. A
 * returning shopper with three items in their cart has not just added
 * anything, and an app that jiggles at itself on every cold start reads as a
 * glitch rather than as feedback.
 */

/** Two digits max: a three-digit badge is wider than the icon it sits on. */
function badgeLabel(count: number): string {
    return count > 99 ? '99+' : String(count);
}

export interface CartTabIconProps {
    focused: boolean;
    /** The tab bar's active/inactive tint, which it passes as a ColorValue. */
    color: ColorValue;
}

export function CartTabIcon({focused, color}: CartTabIconProps) {
    const {data, isPending} = useActiveOrder();
    const count = cartCount(data);

    const scale = useSharedValue(1);
    const previous = useRef(0);
    const seenFirstAnswer = useRef(false);

    useEffect(() => {
        // Until the cart has answered once there is nothing to compare
        // against: the count reads 0 while the request is in flight.
        if (isPending) return;

        if (seenFirstAnswer.current && count > previous.current) {
            scale.value = withSequence(
                withTiming(1.32, {duration: 130, easing: Easing.out(Easing.quad)}),
                // A spring on the way back, so it settles rather than stops.
                withSpring(1, {damping: 7, stiffness: 240}),
            );
        }

        seenFirstAnswer.current = true;
        previous.current = count;
    }, [count, isPending, scale]);

    const style = useAnimatedStyle(() => ({transform: [{scale: scale.value}]}));

    return (
        <Animated.View style={[styles.root, style]}>
            <IconSymbol name={focused ? 'cartFilled' : 'cart'} size={24} color={String(color)} />

            {count > 0 ? (
                <View style={styles.badge}>
                    <Text variant="micro" style={styles.badgeText} tabular>
                        {badgeLabel(count)}
                    </Text>
                </View>
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        // Room for the badge to sit outside the glyph without clipping.
        width: 34,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: -2,
        // `end`, not `right`: the badge follows the icon when Arabic mirrors
        // the tab bar.
        end: 0,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 3,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.sale,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 9,
        lineHeight: 12,
    },
}));
