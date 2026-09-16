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
import {cardPriceDisplay, type CardDiscountLike} from '@/design/card-price';

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

/** `discount` as the fragment returns it: the product-discounts plugin's sale summary. */
export type ProductCardDiscount = CardDiscountLike;

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
    /** Shown in the meta bar. Absent on sources that do not carry it. */
    sku?: string | null;
    /**
     * On-hand count, when the channel reports a real number. Null where stock
     * is masked behind IN_STOCK / LOW_STOCK: see `lib/product-card-extras`,
     * which refuses to invent a figure from an enum.
     */
    stockQuantity?: number | null;
    /** Sale summary; null (or absent, on an older cached card) when nothing is on sale. */
    discount?: ProductCardDiscount | null;
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
    /**
     * Control pinned to the *upper* trailing corner, over the photo, e.g.
     * `WishlistButton`. A slot rather than the button itself, for the same
     * reason as `action`: the design system does not import feature code, and
     * saving a product needs the wishlist store.
     */
    favorite?: React.ReactNode;
    /**
     * Keep the line a struck-through price takes even when this card has none.
     * A list passes true when any of its cards is on sale, so a grid or rail
     * mixing sale and full-price cards keeps one card height.
     */
    reserveSaleLine?: boolean;
}

export function ProductCard({
    product,
    onPress,
    layout = 'grid',
    showPriceRange = true,
    footer,
    action,
    favorite,
    reserveSaleLine = false,
}: ProductCardProps) {
    styles.useVariants({layout});

    const t = useTranslations('Product');
    const tSale = useTranslations('ProductDiscounts');
    const price = cardPriceDisplay(product);
    const outOfStock = product.inStock === false;
    const outOfStockLabel = t('outOfStock');
    const hasSaleBadges =
        price.percentOff !== null || price.quantityDiscount !== null || price.membersOnly;

    // The reference and the count, on one line under the picture — the same
    // bar the web storefront puts there. Each side appears only when its
    // value is known, and the count stays on the trailing edge either way.
    const skuLabel = product.sku?.trim() || undefined;
    const quantityLabel =
        typeof product.stockQuantity === 'number' ? String(product.stockQuantity) : undefined;

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

                {/* Over the photo, on the leading side: the favourite control
                    holds the trailing corner and the stock badge the bottom. */}
                {hasSaleBadges ? (
                    <View style={styles.saleSlot}>
                        {price.percentOff !== null ? (
                            <Badge tone="sale" solid>
                                {price.upTo
                                    ? tSale('upToPercentOff', {percent: price.percentOff})
                                    : tSale('percentOff', {percent: price.percentOff})}
                            </Badge>
                        ) : null}
                        {price.quantityDiscount ? (
                            <Badge tone="sale">
                                {tSale('tierBadge', {
                                    percent: price.quantityDiscount.percentOff,
                                    count: price.quantityDiscount.minQuantity,
                                })}
                            </Badge>
                        ) : null}
                        {price.membersOnly ? (
                            <Badge tone="brand" solid>
                                {tSale('memberPrice')}
                            </Badge>
                        ) : null}
                    </View>
                ) : null}

                {outOfStock ? (
                    <View style={styles.badgeSlot}>
                        <Badge tone="danger">{outOfStockLabel}</Badge>
                    </View>
                ) : null}

                {/* Above the photo and opposite the badge, so the two never
                    collide however tall the badge's label wraps. */}
                {favorite ? <View style={styles.favoriteSlot}>{favorite}</View> : null}
            </View>

            {skuLabel || quantityLabel ? (
                <View style={styles.metaBar}>
                    {skuLabel ? (
                        <Text
                            variant="micro"
                            color="textMuted"
                            numberOfLines={1}
                            style={styles.metaSku}
                        >
                            {skuLabel}
                        </Text>
                    ) : null}
                    {quantityLabel ? (
                        <Text variant="micro" color="textMuted" tabular style={styles.metaQuantity}>
                            {quantityLabel}
                        </Text>
                    ) : null}
                </View>
            ) : null}

            <View style={[styles.body, action ? styles.bodyWithAction : null]}>
                <Text variant="body" numberOfLines={2} style={styles.title}>
                    {product.productName}
                </Text>

                <View style={[styles.priceRow, reserveSaleLine ? styles.priceRowReserved : null]}>
                    {price.isRange && showPriceRange ? (
                        <Text variant="micro" color="textMuted" style={styles.fromLabel}>
                            {t('from')}
                        </Text>
                    ) : null}
                    {/* Stacked: a card is too narrow for a sale price and the
                        struck real price side by side. The percentage is on
                        the photo, so the chip stays off. */}
                    <Price
                        value={price.value}
                        compareAt={price.compareAt}
                        showDiscount={false}
                        layout="stacked"
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
    saleSlot: {
        position: 'absolute',
        top: 0,
        start: 0,
        padding: theme.spacing.sm,
        gap: theme.spacing.xs,
        // Leaves the trailing corner to the favourite control however long a
        // translated label runs.
        maxWidth: '75%',
    },
    badgeSlot: {
        position: 'absolute',
        bottom: 0,
        start: 0,
        padding: theme.spacing.sm,
    },
    favoriteSlot: {
        position: 'absolute',
        top: 0,
        // `end`, not `right`: top right in English, top left in Arabic.
        end: 0,
        padding: theme.spacing.xs,
    },
    metaBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        // Ruled top and bottom, so the bar reads as its own band between the
        // picture and the title rather than as a caption under the image.
        borderTopWidth: theme.elevation.card.borderWidth,
        borderTopColor: theme.colors.border,
        borderBottomWidth: theme.elevation.card.borderWidth,
        borderBottomColor: theme.colors.border,
    },
    metaSku: {
        flexShrink: 1,
    },
    metaQuantity: {
        // Trailing edge even when there is no SKU beside it.
        marginStart: 'auto',
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
        // Top, not centre: a sale price stacks its struck original underneath,
        // and "from" belongs to the first line, not between the two.
        alignItems: 'flex-start',
        gap: theme.spacing.xs,
        flexWrap: 'wrap',
    },
    priceRowReserved: {
        minHeight: theme.typography.bodyStrong.lineHeight + theme.typography.caption.lineHeight,
    },
    fromLabel: {
        // Centres the small label on the price's line.
        paddingTop: (theme.typography.bodyStrong.lineHeight - theme.typography.micro.lineHeight) / 2,
    },
}));
