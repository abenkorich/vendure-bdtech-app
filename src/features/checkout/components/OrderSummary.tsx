import {useMemo} from 'react';
import {View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Price, Divider, IconSymbol} from '@/components/ui';
import {useTranslations} from '@/i18n';
import type {CheckoutOrder} from '@/lib/types';
import {lineSale, totalsBreakdown} from '@/lib/order-discounts';
import {CartTotals} from '@/features/cart/components/CartTotals';
import {SaleCouponNotice} from '@/features/cart/components/SaleCouponNotice';

/**
 * Order summary, for the checkout screen.
 *
 * Every figure is `Money` in integer minor units and goes through `<Price>`.
 * The totals are the cart's own breakdown (`CartTotals`): subtotal before
 * discounts, each discount by name, shipping, total. The two screens a
 * customer compares therefore cannot disagree, and the column adds up to the
 * amount the courier will ask for.
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
    const tSale = useTranslations('ProductDiscounts');
    const currencyCode = order.currencyCode;
    const shippingKnown = Boolean(order.shippingLines?.length);
    const breakdown = useMemo(() => totalsBreakdown(order), [order]);

    return (
        <View style={styles.root}>
            <Text variant="heading">{t('orderSummary')}</Text>

            <View style={styles.lines}>
                {order.lines.map(line => {
                    const sale = lineSale(order, line.id);
                    const compareAt =
                        line.linePriceWithTax > line.discountedLinePriceWithTax
                            ? line.linePriceWithTax
                            : null;

                    return (
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
                                {sale ? (
                                    <View style={styles.saleRow}>
                                        <IconSymbol name="tag" size={12} color="sale" />
                                        <Text
                                            variant="micro"
                                            color="sale"
                                            numberOfLines={1}
                                            style={styles.saleText}
                                        >
                                            {tSale('lineSale', {name: sale.name, percent: sale.percentOff})}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            <Price
                                value={line.discountedLinePriceWithTax}
                                compareAt={compareAt}
                                showDiscount={false}
                                layout="stacked"
                                currencyCode={currencyCode}
                                size="sm"
                                tone={compareAt !== null ? 'sale' : 'text'}
                            />
                        </View>
                    );
                })}
            </View>

            <SaleCouponNotice productDiscounts={order.productDiscounts} currencyCode={currencyCode} />

            <Divider />

            <CartTotals
                currencyCode={currencyCode}
                breakdown={breakdown}
                shippingKnown={shippingKnown}
                shippingUnknownLabel={t('toBeCalculated')}
            />
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
    saleRow: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs},
    saleText: {flexShrink: 1},
}));
