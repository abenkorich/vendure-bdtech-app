import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Price, Divider} from '@/components/ui';
import {CART_STRINGS} from '../strings';

/**
 * Totals breakdown.
 *
 * Every figure is `Money` in integer minor units and renders through `<Price>`,
 * which is the only place the division by 100 happens.
 *
 * The tax line is derived as `withTax - exTax` rather than read from a field:
 * Vendure exposes the two subtotals, not the tax, and computing it here keeps
 * the three rows arithmetically consistent with the total the customer pays.
 */

export interface CartTotalsProps {
    currencyCode: string;
    subTotal: number;
    subTotalWithTax: number;
    shippingWithTax: number;
    totalWithTax: number;
    discounts: readonly {description: string; amountWithTax: number}[];
    /** Before checkout there is no shipping method, so the row says so. */
    shippingKnown?: boolean;
}

export function CartTotals({
    currencyCode,
    subTotal,
    subTotalWithTax,
    shippingWithTax,
    totalWithTax,
    discounts,
    shippingKnown = false,
}: CartTotalsProps) {
    const tax = subTotalWithTax - subTotal;

    return (
        <View style={styles.root}>
            <Row label={CART_STRINGS.subtotal}>
                <Price value={subTotal} currencyCode={currencyCode} size="sm" tone="text" />
            </Row>

            {discounts.map(discount => (
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
                <Row label={CART_STRINGS.tax}>
                    <Price value={tax} currencyCode={currencyCode} size="sm" tone="text" />
                </Row>
            ) : null}

            <Row label={CART_STRINGS.shipping}>
                {shippingKnown ? (
                    <Price
                        value={shippingWithTax}
                        currencyCode={currencyCode}
                        size="sm"
                        tone="text"
                    />
                ) : (
                    <Text variant="caption" color="textMuted">
                        {CART_STRINGS.calculatedAtCheckout}
                    </Text>
                )}
            </Row>

            <Divider />

            <View style={styles.totalRow}>
                <Text variant="bodyStrong">{CART_STRINGS.total}</Text>
                <Price value={totalWithTax} currencyCode={currencyCode} size="lg" />
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
