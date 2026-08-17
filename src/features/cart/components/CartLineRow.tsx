import {useCallback} from 'react';
import {Pressable, View} from 'react-native';
import {Image} from 'expo-image';
import * as Haptics from 'expo-haptics';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Price, Stepper, Badge, IconSymbol} from '@/components/ui';
import type {ActiveOrderLine} from '@/lib/types';
import {CART_STRINGS, skuLabel} from '../strings';

/**
 * One cart line.
 *
 * The stepper writes through immediately — `useAdjustLine` is optimistic, so
 * the number moves on the same frame and the server only gets the last word on
 * settle. Nothing here waits on a promise before re-rendering.
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
}

export function CartLineRow({
    line,
    currencyCode,
    onChangeQuantity,
    onRemove,
    onPressProduct,
    stockWarning,
    disabled = false,
}: CartLineRowProps) {
    const preview = line.productVariant.product.featuredAsset?.preview;

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

                <View style={styles.priceRow}>
                    <Price
                        value={line.unitPriceWithTax}
                        currencyCode={currencyCode}
                        size="sm"
                        tone="textMuted"
                    />
                    <Text variant="micro" color="textMuted">
                        {CART_STRINGS.each}
                    </Text>
                </View>

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
                    <Price
                        value={line.linePriceWithTax}
                        currencyCode={currencyCode}
                        size="md"
                        tone="text"
                    />
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
    warning: {flexDirection: 'row', marginTop: theme.spacing.xs},
    controls: {
        marginTop: theme.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
}));
