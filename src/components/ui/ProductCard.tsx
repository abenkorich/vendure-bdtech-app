import {View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {Text} from './Text';
import {Card} from './Card';
import {Badge} from './Badge';
import {Price} from './Price';
import {Skeleton} from './Skeleton';
import {IconSymbol} from './IconSymbol';
import {useTranslations} from '@/i18n';

/**
 * Product card — the unit the whole catalogue is built from.
 *
 * The prop type is **structural**, matching the shape of the `ProductCard`
 * GraphQL fragment (`src/lib/vendure/fragments.ts`) rather than importing the
 * data layer's generated type. Two reasons: the design system must not depend
 * on `src/lib/**`, and the fragment's `priceWithTax` is a union
 * (`PriceRange | SinglePrice`) that a card has to narrow anyway. If the
 * generated `ProductCardData` lands with a compatible shape it satisfies this
 * interface without a cast.
 */

/** `priceWithTax` as the fragment returns it: a union, not a number. */
export type ProductCardPrice =
    | {__typename?: 'SinglePrice'; value: number}
    | {__typename?: 'PriceRange'; min: number; max: number};

export interface ProductCardData {
    productId: string;
    productName: string;
    slug: string;
    inStock?: boolean | null;
    productAsset?: {preview: string} | null;
    /** Integer minor units. */
    priceWithTax: ProductCardPrice;
    currencyCode: string;
    /** The variant a quick add targets; the search index's preferred one. */
    productVariantId?: string;
}

export interface ProductCardProps {
    product: ProductCardData;
    onPress?: () => void;
    /**
     * `grid` (default) is the two-up catalogue tile; `rail` is the narrower
     * fixed-width tile used in horizontally scrolling home rails.
     */
    layout?: 'grid' | 'rail';
    /** Renders "from X" for a variant price range. Default true. */
    showPriceRange?: boolean;
    /** Slot under the price, e.g. an add-to-cart button. */
    footer?: React.ReactNode;
    /**
     * Round control pinned to the card's lower trailing corner (lower right
     * in LTR, lower left in Arabic), e.g. `QuickAddButton`. The body keeps
     * clear of it so the price never runs underneath.
     */
    action?: React.ReactNode;
}

export function ProductCard({
    product,
    onPress,
    layout = 'grid',
    showPriceRange = true,
    footer,
    action,
}: ProductCardProps) {
    styles.useVariants({layout});

    const t = useTranslations('Product');
    const price = product.priceWithTax;
    const isRange = 'min' in price && 'max' in price && price.min !== price.max;
    const amount = 'value' in price ? price.value : price.min;
    const outOfStock = product.inStock === false;
    const outOfStockLabel = t('outOfStock');

    return (
        <Card
            padding="none"
            onPress={onPress}
            style={styles.card}
            accessibilityLabel={product.productName}
        >
            <View style={styles.media}>
                {product.productAsset?.preview ? (
                    <Image
                        source={{uri: product.productAsset.preview}}
                        style={styles.image}
                        // `contain`: this catalogue is components photographed
                        // on white, and cropping a connector out of frame makes
                        // two different parts look identical.
                        contentFit="contain"
                        transition={160}
                        recyclingKey={product.productId}
                        accessibilityIgnoresInvertColors
                    />
                ) : (
                    // A product with no image is a *settled* state, not a
                    // loading one, so this must not be a Skeleton: a shimmer
                    // that never resolves reads as a broken screen. Part of
                    // this catalogue genuinely has no featuredAsset (verified
                    // against the live API), so this renders regularly.
                    <View style={styles.noImage}>
                        <IconSymbol name="chip" size={28} color="textMuted" />
                    </View>
                )}

                {outOfStock ? (
                    <View style={styles.badgeSlot}>
                        <Badge tone="danger">{outOfStockLabel}</Badge>
                    </View>
                ) : null}
            </View>

            <View style={[styles.body, action ? styles.bodyWithAction : null]}>
                <Text variant="body" numberOfLines={2} style={styles.title}>
                    {product.productName}
                </Text>

                <View style={styles.priceRow}>
                    {isRange && showPriceRange ? (
                        <Text variant="micro" color="textMuted">
                            from
                        </Text>
                    ) : null}
                    <Price
                        value={amount}
                        currencyCode={product.currencyCode}
                        size="md"
                        tone={outOfStock ? 'textMuted' : 'brand'}
                    />
                </View>

                {footer}
            </View>

            {action ? <View style={styles.action}>{action}</View> : null}
        </Card>
    );
}

/** Matching placeholder, so a loading grid has the same geometry as a real one. */
export function ProductCardSkeleton({layout = 'grid'}: {layout?: 'grid' | 'rail'}) {
    styles.useVariants({layout});
    return (
        <Card padding="none" style={styles.card}>
            <View style={styles.media}>
                <Skeleton width="100%" height="100%" radius="none" />
            </View>
            <View style={styles.body}>
                <Skeleton height={14} />
                <Skeleton height={14} width="70%" />
                <Skeleton height={18} width="45%" />
            </View>
        </Card>
    );
}

const styles = StyleSheet.create(theme => ({
    card: {
        variants: {
            layout: {
                grid: {flex: 1},
                // Fixed width so a rail's items align to a predictable rhythm
                // and the next card peeks in, signalling that it scrolls.
                rail: {width: 168},
            },
        },
    },
    media: {
        aspectRatio: 1,
        backgroundColor: theme.colors.surfaceElevated,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    image: {
        // Explicit 100%/100% rather than absoluteFillObject: an absolutely
        // positioned child of a container whose height comes from `aspectRatio`
        // resolved to zero height here, so the image was laid out but never
        // visible. The out-of-stock badge still needs to sit above it, hence
        // the absolute badge slot below rather than an absolute image.
        width: '100%',
        height: '100%',
    },
    noImage: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeSlot: {
        position: 'absolute',
        bottom: 0,
        start: 0,
        padding: theme.spacing.sm,
    },
    body: {
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    bodyWithAction: {
        // Room for the 36pt control plus its gutter.
        paddingEnd: theme.spacing.md + 36 + theme.spacing.sm,
    },
    action: {
        position: 'absolute',
        bottom: theme.spacing.sm,
        end: theme.spacing.sm,
    },
    title: {
        // Two lines reserved: a mixed one/two-line grid leaves prices on a
        // ragged baseline, which is the opposite of a precision instrument.
        minHeight: theme.typography.body.lineHeight * 2,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        flexWrap: 'wrap',
    },
}));
