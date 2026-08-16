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
    locale,
    tone = 'brand',
}: PriceProps) {
    const resolvedLocale = locale ?? deviceLocale();
    const formatted = formatPrice(value, currencyCode, {locale: resolvedLocale});
    const saving =
        compareAt != null ? discountPercent(compareAt, value) : null;
    const onSale = saving != null;

    return (
        <View style={styles.row}>
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

            {onSale ? (
                <Text
                    variant={STRIKE_VARIANT_BY_SIZE[size]}
                    color="textMuted"
                    tabular
                    numberOfLines={1}
                    style={styles.strike}
                >
                    {formatPrice(compareAt!, currencyCode, {locale: resolvedLocale})}
                </Text>
            ) : null}

            {onSale && showDiscount ? (
                <View style={styles.discount}>
                    <Text variant="micro" color="onBrand" tabular>
                        {`-${saving}%`}
                    </Text>
                </View>
            ) : null}
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
