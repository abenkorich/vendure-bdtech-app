import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Price, Divider, formatPrice} from '@/components/ui';
import {useLocale, useTranslations} from '@/i18n';
import type {TotalsBreakdown} from '@/lib/order-discounts';

/**
 * Totals breakdown: subtotal before discounts, one row per discount, shipping,
 * total. Shared by the cart, the checkout summary and order detail, so all
 * three add up the same way.
 *
 * Every figure is `Money` in integer minor units and renders through `<Price>`.
 * The rows come from `totalsBreakdown` (`lib/order-discounts.ts`), which starts
 * from the undiscounted line prices — Vendure's own subtotal is already net of
 * discounts, and a discount row under it would take them off twice — and
 * reconciles the rows with the total, so the column adds up to the number the
 * customer pays.
 *
 * Every price here includes tax, so tax is not a row to add: it is a note
 * under the total.
 */

export interface CartTotalsProps {
    currencyCode: string;
    breakdown: TotalsBreakdown;
    /** Before checkout there is no shipping method, so the row says so. */
    shippingKnown?: boolean;
    /** What the shipping row says while it is unknown. Defaults to the cart's copy. */
    shippingUnknownLabel?: string;
    /**
     * An optimistic change left the discounts and the total for the server to
     * recompute; they are dimmed until it answers.
     */
    pending?: boolean;
}

export function CartTotals({
    currencyCode,
    breakdown,
    shippingKnown = false,
    shippingUnknownLabel,
    pending = false,
}: CartTotalsProps) {
    const t = useTranslations('Cart');
    const {locale} = useLocale();

    return (
        <View style={styles.root}>
            <Row label={t('subtotal')}>
                <Price value={breakdown.subtotal} currencyCode={currencyCode} size="sm" tone="text" />
            </Row>

            {breakdown.rows.map(row => (
                <Row
                    key={row.key}
                    label={row.label ?? t('adjustments')}
                    tone={row.delta < 0 ? 'success' : 'textMuted'}
                    pending={pending}
                >
                    <Price value={row.delta} currencyCode={currencyCode} size="sm" tone="text" />
                </Row>
            ))}

            <Row label={t('shipping')}>
                {shippingKnown ? (
                    <Price
                        value={breakdown.shipping}
                        currencyCode={currencyCode}
                        size="sm"
                        tone="text"
                    />
                ) : (
                    <Text variant="caption" color="textMuted">
                        {shippingUnknownLabel ?? t('calculatedAtCheckout')}
                    </Text>
                )}
            </Row>

            <Divider />

            <View
                style={[styles.totalRow, pending && styles.pending]}
                accessibilityState={{busy: pending}}
            >
                <Text variant="bodyStrong">{t('total')}</Text>
                <Price value={breakdown.total} currencyCode={currencyCode} size="lg" />
            </View>

            {breakdown.taxIncluded > 0 ? (
                <Text
                    variant="micro"
                    color="textMuted"
                    align="end"
                    style={pending ? styles.pending : undefined}
                >
                    {t('includesTax', {
                        amount: formatPrice(breakdown.taxIncluded, currencyCode, {locale}),
                    })}
                </Text>
            ) : null}
        </View>
    );
}

function Row({
    label,
    tone = 'textMuted',
    pending = false,
    children,
}: {
    label: string;
    tone?: 'textMuted' | 'success';
    pending?: boolean;
    children: React.ReactNode;
}) {
    return (
        <View style={[styles.row, pending && styles.pending]} accessibilityState={{busy: pending}}>
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
    // Same dimming as a disabled chip: visibly on its way, still legible.
    pending: {opacity: 0.4},
}));
