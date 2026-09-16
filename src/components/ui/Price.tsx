import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, type TextVariant} from './Text';
import {formatPrice, discountPercent} from '@/design/format-price';
import {deviceLocale} from '@/design/locale';

/**
 * Price display.
 *
 * `value` is Vendure `Money`: an **integer in minor units** (centimes). The
 * division lives in `@/design/format-price` and is unit-tested, because a price
 * rendered 100x too large still looks like a real number and would ship.
 *
 * Always tabular: a price that shifts horizontally as a quantity changes reads
 * as a glitch, and a column of prices that does not align reads as sloppy.
 */

export type PriceSize = 'sm' | 'md' | 'lg';

const VARIANT_BY_SIZE: Record<PriceSize, TextVariant> = {
    sm: 'caption',
    md: 'bodyStrong',
    lg: 'title',
};

const STRIKE_VARIANT_BY_SIZE: Record<PriceSize, TextVariant> = {
    sm: 'micro',
    md: 'caption',
    lg: 'body',
};

export interface PriceProps {
    /** Integer minor units, exactly as Vendure returns it. */
    value: number;
    /** ISO 4217 code from the channel, e.g. `DZD`. */
    currencyCode: string;
    size?: PriceSize;
    /**
     * Original price in minor units, when the item is discounted. Rendered
     * struck through beside the current price, plus a saving percentage.
     */
    compareAt?: number | null;
    /** Show the `-25%` chip next to a struck-through compareAt. Default true. */
    showDiscount?: boolean;
    /**
     * The saving as the server computed it, for the chip. Without it the chip
     * derives one from `compareAt`; the product-discounts plugin rounds the
     * same way, but its own figure is the one printed everywhere else.
     */
    percentOff?: number | null;
    /**
     * `inline` (default) sets the struck-through price beside the current one.
     * `stacked` gives it its own line underneath, for narrow slots such as a
     * two-up card, where inline the pair does not fit and a number would be cut
     * short, which is the one thing a price must never be.
     */
    layout?: 'inline' | 'stacked';
    /** Locale override. Defaults to the device locale. */
    locale?: string;
    /**
     * `brand` (default) marks the price as the primary signal it is. `text` is
     * for dense contexts — a cart line's per-unit price, an order summary row —
     * where every row being accent-colored would turn a signal into decoration.
     */
    tone?: 'brand' | 'text' | 'sale' | 'textMuted';
}

export function Price({
    value,
    currencyCode,
    size = 'md',
    compareAt,
    showDiscount = true,
    percentOff,
    layout = 'inline',
    locale,
    tone = 'brand',
}: PriceProps) {
    const resolvedLocale = locale ?? deviceLocale();
    const formatted = formatPrice(value, currencyCode, {locale: resolvedLocale});
    const derived = compareAt != null ? discountPercent(compareAt, value) : null;
    // The server's percentage only ever labels a real saving: without one the
    // chip is not shown at all.
    const saving = derived != null && percentOff != null && percentOff > 0 ? percentOff : derived;
    const onSale = saving != null;

    const current = (
        <Text
            variant={VARIANT_BY_SIZE[size]}
            color={onSale && tone === 'brand' ? 'sale' : tone}
            tabular
            // A price is data, not prose: it must not wrap or ellipsize
            // into something that reads as a different number.
            numberOfLines={1}
            accessibilityLabel={formatted}
        >
            {formatted}
        </Text>
    );

    const struck = onSale ? (
        <Text
            variant={STRIKE_VARIANT_BY_SIZE[size]}
            color="textMuted"
            tabular
            numberOfLines={1}
            style={styles.strike}
        >
            {formatPrice(compareAt!, currencyCode, {locale: resolvedLocale})}
        </Text>
    ) : null;

    const chip =
        onSale && showDiscount ? (
            <View style={styles.discount}>
                <Text variant="micro" color="onBrand" tabular>
                    {`-${saving}%`}
                </Text>
            </View>
        ) : null;

    if (layout === 'stacked') {
        return (
            <View style={styles.stack}>
                <View style={styles.row}>
                    {current}
                    {chip}
                </View>
                {struck}
            </View>
        );
    }

    return (
        <View style={styles.row}>
            {current}
            {struck}
            {chip}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        // `gap` is direction-agnostic, so this row reverses correctly in Arabic
        // without a single left/right value.
        gap: theme.spacing.sm,
        flexShrink: 1,
    },
    stack: {
        alignItems: 'flex-start',
        flexShrink: 1,
    },
    strike: {
        textDecorationLine: 'line-through',
    },
    discount: {
        backgroundColor: theme.colors.sale,
        paddingHorizontal: theme.spacing.xs,
        paddingVertical: 2,
        borderRadius: theme.radius.sm,
    },
}));
