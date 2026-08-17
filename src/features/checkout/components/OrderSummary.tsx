import {View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Price, Divider} from '@/components/ui';
import {useTranslations} from '@/i18n';
import type {CheckoutOrder} from '@/lib/types';

/**
 * Order summary, for the checkout screen.
 *
 * Every figure is `Money` in integer minor units and goes through `<Price>`.
 * There is no arithmetic in this component beyond the tax line — which is
 * derived as `subTotalWithTax - subTotal` for the same reason `CartTotals`
 * derives it: Vendure exposes the two subtotals rather than the tax, and
 * computing it here keeps the rows consistent with the total the customer
 * pays.
 *
 * Shipping shows "to be calculated" until a method is on the order, rather than
 * a confident `0.00 DZD`. A free-looking delivery that later costs 600 DZD is
 * the single most damaging thing this screen could get wrong.
 */

export interface OrderSummaryProps {
    order: CheckoutOrder;
}

export function OrderSummary({order}: OrderSummaryProps) {
    const t = useTranslations('Checkout');
    const currencyCode = order.currencyCode;
    const tax = order.subTotalWithTax - order.subTotal;
    const shippingKnown = Boolean(order.shippingLines?.length);

    return (
        <View style={styles.root}>
            <Text variant="heading">{t('orderSummary')}</Text>

            <View style={styles.lines}>
                {order.lines.map(line => (
                    <View key={line.id} style={styles.line}>
                        {line.productVariant.product.featuredAsset?.preview ? (
                            <Image
                                source={{uri: line.productVariant.product.featuredAsset.preview}}
                                style={styles.thumb}
                                contentFit="cover"
                                transition={120}
                            />
                        ) : (
                            <View style={[styles.thumb, styles.thumbEmpty]} />
                        )}

                        <View style={styles.lineBody}>
                            <Text variant="caption" numberOfLines={2}>
                                {line.productVariant.name}
                            </Text>
                            <Text variant="micro" color="textMuted" tabular>
                                {t('qty', {quantity: line.quantity})}
                            </Text>
                        </View>

                        <Price
                            value={line.linePriceWithTax}
                            currencyCode={currencyCode}
                            size="sm"
                            tone="text"
                        />
                    </View>
                ))}
            </View>

            <Divider />

            <Row label={t('subtotal')}>
                <Price value={order.subTotal} currencyCode={currencyCode} size="sm" tone="text" />
            </Row>

            {order.discounts.map(discount => (
                <Row key={discount.description} label={discount.description} tone="success">
                    <Price
                        value={discount.amountWithTax}
                        currencyCode={currencyCode}
                        size="sm"
                        tone="text"
                    />
                </Row>
            ))}

            {tax > 0 ? (
                <Row label={t('tax')}>
                    <Price value={tax} currencyCode={currencyCode} size="sm" tone="text" />
                </Row>
            ) : null}

            <Row label={t('shipping')}>
                {shippingKnown ? (
                    <Price
                        value={order.shippingWithTax}
                        currencyCode={currencyCode}
                        size="sm"
                        tone="text"
                    />
                ) : (
                    <Text variant="caption" color="textMuted">
                        {t('toBeCalculated')}
                    </Text>
                )}
            </Row>

            <Divider />

            <View style={styles.totalRow}>
                <Text variant="bodyStrong">{t('total')}</Text>
                <Price value={order.totalWithTax} currencyCode={currencyCode} size="lg" />
            </View>
        </View>
    );
}

function Row({
    label,
    tone = 'textMuted',
    children,
}: {
    label: string;
    tone?: 'textMuted' | 'success';
    children: React.ReactNode;
}) {
    return (
        <View style={styles.row}>
            <Text variant="caption" color={tone} numberOfLines={1} style={styles.rowLabel}>
                {label}
            </Text>
            {children}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.sm},
    lines: {gap: theme.spacing.md, paddingBottom: theme.spacing.xs},
    line: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md},
    thumb: {
        width: 44,
        height: 44,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceElevated,
    },
    thumbEmpty: {borderWidth: theme.elevation.card.borderWidth, borderColor: theme.colors.border},
    lineBody: {flex: 1, gap: theme.spacing.xs},
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    rowLabel: {flexShrink: 1},
    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingTop: theme.spacing.xs,
    },
}));
