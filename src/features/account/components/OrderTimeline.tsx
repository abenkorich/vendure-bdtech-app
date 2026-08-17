import {useMemo} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Badge, IconSymbol} from '@/components/ui';
import {translate} from '../i18n';

/**
 * Order status timeline.
 *
 * Vendure's state machine has more states than a customer cares about, so the
 * timeline shows the six milestones the `Account.timeline.*` catalog already
 * names and maps every real state onto one of them. Terminal states that are
 * not on the happy path (Cancelled) are not a step at all — drawing "Cancelled"
 * as progress toward delivery would be actively misleading — so they render as
 * a single status marker instead.
 */

const STEPS = [
    'AddingItems',
    'ArrangingPayment',
    'PaymentAuthorized',
    'PaymentSettled',
    'Shipped',
    'Delivered',
] as const;

type Step = (typeof STEPS)[number];

/** Real Vendure states → the milestone they have reached. */
const STATE_TO_STEP: Record<string, Step> = {
    Draft: 'AddingItems',
    AddingItems: 'AddingItems',
    ArrangingPayment: 'ArrangingPayment',
    PaymentAuthorized: 'PaymentAuthorized',
    PaymentSettled: 'PaymentSettled',
    PartiallyShipped: 'Shipped',
    Shipped: 'Shipped',
    PartiallyDelivered: 'Shipped',
    Delivered: 'Delivered',
    Modifying: 'ArrangingPayment',
    ArrangingAdditionalPayment: 'ArrangingPayment',
};

export function orderStateTone(state: string): 'success' | 'brand' | 'danger' | 'neutral' {
    if (state === 'Cancelled') return 'danger';
    if (state === 'Delivered') return 'success';
    if (state === 'Shipped' || state === 'PartiallyShipped') return 'brand';
    return 'neutral';
}

export function orderStateLabel(state: string): string {
    // OrderStatus carries every state; fall back to the raw state rather than
    // rendering the key path if the backend adds one.
    const label = translate(`OrderStatus.${state}`);
    return label === `OrderStatus.${state}` ? state : label;
}

export function OrderTimeline({state}: {state: string}) {
    const currentIndex = useMemo(() => {
        const step = STATE_TO_STEP[state];
        return step ? STEPS.indexOf(step) : -1;
    }, [state]);

    if (state === 'Cancelled' || currentIndex === -1) {
        return (
            <View style={styles.cancelled}>
                <IconSymbol name="error" size={18} color="danger" />
                <Text variant="bodyStrong" color="danger">
                    {orderStateLabel(state)}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.root} accessibilityLabel={translate('Account.orderProgress')}>
            {STEPS.map((step, index) => {
                const done = index <= currentIndex;
                const current = index === currentIndex;
                return (
                    <View key={step} style={styles.step}>
                        <View style={styles.railRow}>
                            {/* Rails are drawn per-step rather than as one
                                absolute line so the whole thing flips with the
                                writing direction for free in Arabic. */}
                            <View style={[styles.rail, index === 0 && styles.railHidden, done && styles.railDone]} />
                            <View
                                style={[
                                    styles.dot,
                                    done && styles.dotDone,
                                    current && styles.dotCurrent,
                                ]}
                            >
                                {done && !current ? (
                                    <IconSymbol name="check" size={10} color="onBrand" />
                                ) : null}
                            </View>
                            <View
                                style={[
                                    styles.rail,
                                    index === STEPS.length - 1 && styles.railHidden,
                                    index < currentIndex && styles.railDone,
                                ]}
                            />
                        </View>
                        <Text
                            variant="micro"
                            color={done ? 'text' : 'textMuted'}
                            align="center"
                            numberOfLines={2}
                        >
                            {translate(`Account.timeline.${step}`)}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

/** Compact status chip, for list rows. */
export function OrderStateBadge({state}: {state: string}) {
    return <Badge tone={orderStateTone(state)}>{orderStateLabel(state)}</Badge>;
}

const styles = StyleSheet.create(theme => ({
    root: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    step: {
        flex: 1,
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    railRow: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'stretch',
    },
    rail: {
        flex: 1,
        height: 2,
        backgroundColor: theme.colors.border,
    },
    railDone: {
        backgroundColor: theme.colors.brand,
    },
    railHidden: {
        backgroundColor: 'transparent',
    },
    dot: {
        width: 16,
        height: 16,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    dotDone: {
        backgroundColor: theme.colors.brand,
        borderColor: theme.colors.brand,
    },
    dotCurrent: {
        // The live step is a ring, not a fill: it reads as "here" rather than
        // "finished", which the filled+check steps behind it already say.
        backgroundColor: theme.colors.background,
        borderColor: theme.colors.brand,
        borderWidth: 4,
        width: 18,
        height: 18,
    },
    cancelled: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
}));
