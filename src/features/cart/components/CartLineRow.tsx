import {useCallback} from 'react';
import {Pressable, View} from 'react-native';
import {Image} from 'expo-image';
import * as Haptics from 'expo-haptics';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Price, Stepper, Badge, IconSymbol} from '@/components/ui';
import {useTranslations} from '@/i18n';
import type {ActiveOrderLine} from '@/lib/types';
import type {LineSaleLike} from '@/lib/order-discounts';
import {CART_STRINGS, skuLabel} from '../strings';

/**
 * One cart line.
 *
 * The stepper writes through immediately — `useAdjustLine` is optimistic, so
 * the number moves on the same frame and the server only gets the last word on
 * settle. Nothing here waits on a promise before re-rendering.
 *
 * A line on sale shows the sale unit price over its struck real price, the
 * discount's name, and, when a per-order cap leaves some units at full price,
 * how many units the sale covers. The line total is Vendure's discounted line
 * price, struck at the undiscounted one. When an optimistic change leaves the
 * discounted figures for the server (see `lib/cart-math.ts`), they are dimmed
 * rather than guessed.
 *
 * Layout is a plain flex row with `gap` and logical padding, so it mirrors in
 * Arabic without a single left/right value.
 */

export interface CartLineRowProps {
    line: ActiveOrderLine;
    currencyCode: string;
    onChangeQuantity: (quantity: number) => void;
    onRemove: () => void;
    onPressProduct?: () => void;
    /** Server said this line exceeds available stock. */
    stockWarning?: string | null;
    disabled?: boolean;
    /** The product discount on this line (`Order.productDiscounts`), if any. */
    sale?: LineSaleLike | null;
    /** Its discounted price awaits the server after an optimistic change. */
    pending?: boolean;
}

export function CartLineRow({
    line,
    currencyCode,
    onChangeQuantity,
    onRemove,
    onPressProduct,
    stockWarning,
    disabled = false,
    sale = null,
    pending = false,
}: CartLineRowProps) {
    const t = useTranslations('ProductDiscounts');
    const preview = line.productVariant.product.featuredAsset?.preview;

    // The sale takes the same amount off each unit it covers.
    const saleUnitPrice = sale ? line.unitPriceWithTax - sale.unitSavingWithTax : null;
    const lineCompareAt =
        line.linePriceWithTax > line.discountedLinePriceWithTax ? line.linePriceWithTax : null;

    const handleChange = useCallback(
        (next: number) => {
            if (next <= 0) {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onRemove();
                return;
            }
            onChangeQuantity(next);
        },
        [onChangeQuantity, onRemove],
    );

    return (
        <View style={styles.row}>
            <Pressable
                style={styles.media}
                onPress={onPressProduct}
                accessibilityRole={onPressProduct ? 'button' : undefined}
                accessibilityLabel={line.productVariant.product.name}
            >
                {preview ? (
                    <Image
                        source={{uri: preview}}
                        style={styles.image}
                        contentFit="contain"
                        transition={160}
                        recyclingKey={line.id}
                        accessibilityIgnoresInvertColors
                    />
                ) : (
                    <IconSymbol name="package" size={24} color="textMuted" />
                )}
            </Pressable>

            <View style={styles.body}>
                <Text variant="bodyStrong" numberOfLines={2}>
                    {line.productVariant.product.name}
                </Text>

                <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {line.productVariant.name}
                </Text>

                {line.productVariant.sku ? (
                    <Text variant="micro" color="textMuted" tabular numberOfLines={1}>
                        {skuLabel(line.productVariant.sku)}
                    </Text>
                ) : null}

                <View style={[styles.priceRow, pending && styles.pending]}>
                    <Price
                        value={saleUnitPrice ?? line.unitPriceWithTax}
                        compareAt={saleUnitPrice !== null ? line.unitPriceWithTax : null}
                        showDiscount={false}
                        currencyCode={currencyCode}
                        size="sm"
                        tone="textMuted"
                    />
                    <Text variant="micro" color="textMuted">
                        {CART_STRINGS.each}
                    </Text>
                </View>

                {sale ? (
                    <View style={[styles.saleRow, pending && styles.pending]}>
                        <IconSymbol name="tag" size={12} color="sale" />
                        <Text variant="micro" color="sale" numberOfLines={1} style={styles.saleText}>
                            {t('lineSale', {name: sale.name, percent: sale.percentOff})}
                        </Text>
                    </View>
                ) : null}

                {sale && sale.discountedQuantity < line.quantity ? (
                    <Text variant="micro" color="textMuted" style={pending ? styles.pending : undefined}>
                        {t('saleOnPart', {count: sale.discountedQuantity, quantity: line.quantity})}
                    </Text>
                ) : null}

                {stockWarning ? (
                    <View style={styles.warning}>
                        <Badge tone="danger" icon="warning">
                            {stockWarning}
                        </Badge>
                    </View>
                ) : null}

                <View style={styles.controls}>
                    <Stepper
                        value={line.quantity}
                        onChange={handleChange}
                        min={0}
                        max={99}
                        size="sm"
                        disabled={disabled}
                        label={line.productVariant.product.name}
                    />
                    <View style={pending ? styles.pending : undefined} accessibilityState={{busy: pending}}>
                        <Price
                            value={line.discountedLinePriceWithTax}
                            compareAt={lineCompareAt}
                            showDiscount={false}
                            layout="stacked"
                            currencyCode={currencyCode}
                            size="md"
                            tone={lineCompareAt !== null ? 'sale' : 'text'}
                        />
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
    },
    media: {
        width: 76,
        height: 76,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    image: {width: '100%', height: '100%'},
    body: {flex: 1, gap: theme.spacing.xs},
    priceRow: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs},
    saleRow: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs},
    saleText: {flexShrink: 1},
    warning: {flexDirection: 'row', marginTop: theme.spacing.xs},
    controls: {
        marginTop: theme.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    // Same dimming as a disabled chip: visibly on its way, still legible.
    pending: {opacity: 0.4},
}));
