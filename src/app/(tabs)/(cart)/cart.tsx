import {useCallback, useMemo, useState} from 'react';
import {ScrollView, View} from 'react-native';
import {useRouter} from 'expo-router';
import * as Haptics from 'expo-haptics';
import {StyleSheet} from 'react-native-unistyles';
import {Screen, Text, Button, Divider, EmptyState, Skeleton, Card} from '@/components/ui';
import {
    useActiveOrder,
    useAdjustLine,
    useRemoveLine,
    useAddToCart,
    useApplyCoupon,
    useRemoveCoupon,
} from '@/features/cart/queries';
import {CartLineRow} from '@/features/cart/components/CartLineRow';
import {CartTotals} from '@/features/cart/components/CartTotals';
import {CouponField} from '@/features/cart/components/CouponField';
import {SaleCouponNotice} from '@/features/cart/components/SaleCouponNotice';
import {lineSale, totalsBreakdown} from '@/lib/order-discounts';
import {UndoBar} from '@/features/cart/components/UndoBar';
import {ErrorBanner} from '@/features/cart/components/ErrorBanner';
import {CART_STRINGS, itemCountLabel} from '@/features/cart/strings';
import {presentError, type PresentedError} from '@/features/cart/errors';

/**
 * Cart.
 *
 * Every mutation here is optimistic (see `features/cart/queries.ts`), so the
 * screen never shows a spinner over a quantity: the tap lands, the number
 * moves, and the server gets the last word on settle. The only deliberate
 * exception is the coupon, which cannot be predicted client-side.
 *
 * A removed line is not confirmed with a dialog. It is removed immediately and
 * offered back through `UndoBar` — the reversal is one tap and costs nothing,
 * whereas a confirm dialog taxes every removal to protect the rare misfire.
 */

interface RemovedLine {
    variantId: string;
    quantity: number;
}

export default function CartScreen() {
    const router = useRouter();
    const {data: order, isPending, error, refetch} = useActiveOrder();

    const adjustLine = useAdjustLine();
    const removeLine = useRemoveLine();
    const addToCart = useAddToCart();
    const applyCoupon = useApplyCoupon();
    const removeCoupon = useRemoveCoupon();

    const [removed, setRemoved] = useState<RemovedLine | null>(null);
    const [actionError, setActionError] = useState<PresentedError | null>(null);

    const lines = order?.lines ?? [];
    const currencyCode = order?.currencyCode ?? 'DZD';

    const handleAdjust = useCallback(
        (lineId: string, quantity: number) => {
            setActionError(null);
            adjustLine.mutate(
                {lineId, quantity},
                {
                    onError: caught => {
                        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        setActionError(presentError(caught));
                    },
                },
            );
        },
        [adjustLine],
    );

    const handleRemove = useCallback(
        (lineId: string, variantId: string, quantity: number) => {
            setActionError(null);
            // Captured before the mutation so undo can re-add the exact
            // quantity, not just one unit.
            setRemoved({variantId, quantity});
            removeLine.mutate(
                {lineId},
                {
                    onError: caught => {
                        setRemoved(null);
                        setActionError(presentError(caught));
                    },
                },
            );
        },
        [removeLine],
    );

    const handleUndo = useCallback(() => {
        if (!removed) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        addToCart.mutate(
            {variantId: removed.variantId, quantity: removed.quantity},
            {onError: caught => setActionError(presentError(caught))},
        );
        setRemoved(null);
    }, [removed, addToCart]);

    // Rows that add up to the total. Not reconciled while an optimistic change
    // has the discounts on their way back from the server.
    const breakdown = useMemo(
        () => (order ? totalsBreakdown(order, {pending: order.totalsPending}) : null),
        [order],
    );

    if (isPending) {
        return (
            <Screen>
                <Header count={0} />
                <View style={styles.list}>
                    {[0, 1, 2].map(index => (
                        <View key={index} style={styles.skeletonRow}>
                            <Skeleton width={76} height={76} radius="md" />
                            <View style={styles.skeletonBody}>
                                <Skeleton width="80%" height={16} />
                                <Skeleton width="50%" height={12} />
                                <Skeleton width="35%" height={14} />
                            </View>
                        </View>
                    ))}
                </View>
            </Screen>
        );
    }

    if (error) {
        const presented = presentError(error);
        return (
            <Screen>
                <Header count={0} />
                <View style={styles.centered}>
                    <EmptyState
                        tone="error"
                        title={
                            presented.retryable
                                ? CART_STRINGS.serverUnreachableTitle
                                : CART_STRINGS.somethingWentWrong
                        }
                        message={presented.message}
                        action={{label: CART_STRINGS.tryAgain, onPress: () => void refetch()}}
                    />
                </View>
            </Screen>
        );
    }

    if (!order || lines.length === 0) {
        return (
            <Screen>
                <Header count={0} />
                <View style={styles.centered}>
                    <EmptyState
                        icon="cart"
                        title={CART_STRINGS.empty}
                        message={CART_STRINGS.emptyMessage}
                        action={{
                            label: CART_STRINGS.continueShopping,
                            onPress: () => router.push('/shop'),
                        }}
                    />
                </View>
            </Screen>
        );
    }

    return (
        <Screen>
            <Header count={order.totalQuantity} />

            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {actionError ? (
                    <View style={styles.banner}>
                        <ErrorBanner
                            error={actionError}
                            onRetry={() => void refetch()}
                            onDismiss={() => setActionError(null)}
                        />
                    </View>
                ) : null}

                <View style={styles.list}>
                    {lines.map((line, index) => (
                        <View key={line.id}>
                            {index > 0 ? <Divider /> : null}
                            <CartLineRow
                                line={line}
                                currencyCode={currencyCode}
                                sale={lineSale(order, line.id)}
                                pending={order.pendingLineIds?.includes(line.id) ?? false}
                                onChangeQuantity={quantity => handleAdjust(line.id, quantity)}
                                onRemove={() =>
                                    handleRemove(
                                        line.id,
                                        line.productVariant.id,
                                        line.quantity,
                                    )
                                }
                                onPressProduct={() =>
                                    router.push(
                                        `/product/${line.productVariant.product.slug}` as never,
                                    )
                                }
                            />
                        </View>
                    ))}
                </View>

                <Card variant="raised" padding="lg" style={styles.card}>
                    <View style={styles.couponBody}>
                        <CouponField
                            appliedCodes={order.couponCodes}
                            onApply={code => applyCoupon.mutateAsync(code)}
                            onRemove={code => removeCoupon.mutate(code)}
                            applying={applyCoupon.isPending}
                        />
                        {/* Beside the coupon chips it explains: a code that
                            stays on the order while giving nothing. */}
                        <SaleCouponNotice
                            productDiscounts={order.productDiscounts}
                            currencyCode={currencyCode}
                        />
                    </View>
                </Card>

                <Card variant="raised" padding="lg" style={styles.card}>
                    <Text variant="heading">{CART_STRINGS.orderSummary}</Text>
                    <View style={styles.totals}>
                        {breakdown ? (
                            <CartTotals
                                currencyCode={currencyCode}
                                breakdown={breakdown}
                                // A method chosen at checkout stays on the order
                                // when the shopper comes back here, and its price
                                // is already inside the total.
                                shippingKnown={breakdown.hasShippingLines}
                                pending={order.totalsPending ?? false}
                            />
                        ) : null}
                    </View>
                </Card>
            </ScrollView>

            <UndoBar
                visible={removed !== null}
                message={CART_STRINGS.removedItem}
                actionLabel={CART_STRINGS.undo}
                onAction={handleUndo}
                onExpire={() => setRemoved(null)}
            />

            <View style={styles.sticky}>
                <Divider />
                <View style={styles.stickyInner}>
                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        icon="lock"
                        onPress={() => router.push('/checkout')}
                    >
                        {CART_STRINGS.proceedToCheckout}
                    </Button>
                </View>
            </View>
        </Screen>
    );
}

function Header({count}: {count: number}) {
    return (
        <View style={styles.header}>
            <Text variant="title">{CART_STRINGS.title}</Text>
            {count > 0 ? (
                <Text variant="caption" color="textMuted" tabular>
                    {itemCountLabel(count)}
                </Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    header: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
        gap: theme.spacing.xs,
    },
    scroll: {paddingBottom: theme.spacing['2xl']},
    banner: {paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md},
    list: {paddingHorizontal: theme.spacing.lg},
    card: {marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg},
    couponBody: {gap: theme.spacing.md},
    totals: {marginTop: theme.spacing.md},
    centered: {flex: 1, justifyContent: 'center'},
    sticky: {backgroundColor: theme.colors.surface},
    stickyInner: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.md,
    },
    skeletonRow: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
    },
    skeletonBody: {flex: 1, gap: theme.spacing.sm},
}));
