import {useEffect, useRef, useState} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Badge, Price, IconSymbol} from '@/components/ui';
import {useLocale, useTranslations, type MessageValues} from '@/i18n';
import {formatDate} from '@/lib/format';
import {
    nextSaleTimingChange,
    reachedTier,
    saleTiming,
    type QuantityDiscountLike,
    type VariantDiscountLike,
} from '@/lib/product-discounts';

/**
 * The sale on the selected variant, under its price: the discount's name,
 * member price, when it ends, how many are left at this price, the per-order
 * cap, and the quantity tiers, with the one the chosen quantity reaches.
 *
 * All of it is the server's answer (`ProductVariant.discount` and
 * `quantityDiscounts`). The one thing kept here is time: within three days of
 * its end the sale counts down, re-rendering only when the displayed minute
 * changes; and when it ends on screen the price above is stale, so `onEnded`
 * asks the screen to refetch rather than leaving a sale price up that the
 * cart would no longer honour.
 */

export interface SaleDetailsProps {
    variant: {
        priceWithTax: number;
        discount?: VariantDiscountLike | null;
        quantityDiscounts?: readonly QuantityDiscountLike[] | null;
    };
    /** The quantity chosen on the page, which decides the tier reached. */
    quantity: number;
    currencyCode: string;
    onEnded?: () => void;
}

type Translate = (key: string, values?: MessageValues) => string;

function countdownLabel(
    t: Translate,
    timing: {days: number; hours: number; minutes: number},
): string {
    if (timing.days > 0) return t('countdownDays', {days: timing.days, hours: timing.hours});
    if (timing.hours > 0) return t('countdownHours', {hours: timing.hours, minutes: timing.minutes});
    return t('countdownMinutes', {minutes: timing.minutes});
}

export function SaleDetails({variant, quantity, currencyCode, onEnded}: SaleDetailsProps) {
    const t = useTranslations('ProductDiscounts');
    const {locale} = useLocale();
    const sale = variant.discount ?? null;
    const tiers = variant.quantityDiscounts ?? [];
    const endsAt = sale?.endsAt ?? null;

    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const delay = nextSaleTimingChange(endsAt, now);
        if (delay === null) return;
        const timer = setTimeout(() => setNow(Date.now()), delay);
        return () => clearTimeout(timer);
    }, [endsAt, now]);

    const timing = saleTiming(endsAt, now);
    const ended = timing?.kind === 'ended';

    // Once per end date, however many renders see it ended.
    const reportedEnd = useRef<string | null>(null);
    useEffect(() => {
        if (!ended || !endsAt || reportedEnd.current === endsAt) return;
        reportedEnd.current = endsAt;
        onEnded?.();
    }, [ended, endsAt, onEnded]);

    if (!sale && tiers.length === 0) return null;

    const live = sale !== null && !ended;
    const tier = reachedTier(variant, quantity);

    return (
        <View style={styles.root}>
            {live ? (
                <View style={styles.badges}>
                    <Badge tone="sale" solid icon="tag">
                        {sale.name}
                    </Badge>
                    {sale.membersOnly ? (
                        <Badge tone="brand" solid>
                            {t('memberPrice')}
                        </Badge>
                    ) : null}
                </View>
            ) : null}

            {live && timing?.kind === 'countdown' ? (
                <Text variant="caption" color="sale" tabular>
                    {t('endsIn', {time: countdownLabel(t, timing)})}
                </Text>
            ) : null}

            {live && timing?.kind === 'date' ? (
                <Text variant="caption" color="textMuted">
                    {t('endsOn', {date: formatDate(timing.endsAt, 'long', locale)})}
                </Text>
            ) : null}

            {live && sale.unitsRemaining != null ? (
                <Text variant="caption" color="sale" tabular>
                    {t('unitsLeft', {count: sale.unitsRemaining})}
                </Text>
            ) : null}

            {live && sale.maxQuantityPerOrder != null ? (
                <Text variant="caption" color="textMuted" tabular>
                    {t('maxPerOrder', {count: sale.maxQuantityPerOrder})}
                </Text>
            ) : null}

            {tiers.length > 0 ? (
                <View style={styles.tiers}>
                    <Text variant="micro" color="textMuted" uppercase>
                        {t('tiersTitle')}
                    </Text>
                    {tiers.map(candidate => {
                        const reached = candidate === tier;
                        return (
                            <View
                                key={`${candidate.productDiscountId}:${candidate.minQuantity}`}
                                style={[styles.tier, reached && styles.tierReached]}
                                accessibilityState={{selected: reached}}
                            >
                                <View style={styles.tierText}>
                                    <Text variant="caption" color={reached ? 'brand' : 'text'} tabular>
                                        {t('fromQuantity', {count: candidate.minQuantity})}
                                    </Text>
                                    {candidate.membersOnly ? (
                                        <Text variant="micro" color="brand">
                                            {t('memberPrice')}
                                        </Text>
                                    ) : null}
                                </View>
                                <Price
                                    value={candidate.priceWithTax}
                                    compareAt={variant.priceWithTax}
                                    percentOff={candidate.percentOff}
                                    currencyCode={currencyCode}
                                    size="sm"
                                    tone="text"
                                />
                                {reached ? <IconSymbol name="check" size={14} color="brand" /> : null}
                            </View>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.xs},
    badges: {flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs},
    tiers: {marginTop: theme.spacing.sm, gap: theme.spacing.xs},
    tier: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    tierReached: {
        // A brand hairline and the muted wash, as on a selected variant chip.
        borderColor: theme.colors.brand,
        backgroundColor: theme.colors.brandMuted,
    },
    tierText: {flex: 1, gap: 2},
}));
