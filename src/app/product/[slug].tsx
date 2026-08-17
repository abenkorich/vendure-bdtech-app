import {useCallback, useMemo, useState} from 'react';
import {View, ScrollView, Alert} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import {useLocalSearchParams, router} from 'expo-router';
import {
    Screen,
    Text,
    Button,
    Price,
    Badge,
    Divider,
    Skeleton,
    EmptyState,
    IconSymbol,
} from '@/components/ui';
import {useProduct} from '@/features/product/queries';
import {useCollection} from '@/features/collection/queries';
import {useAddToCart} from '@/features/cart/queries';
import {getDisplayOptionGroups} from '@/lib/vendure/product-options';
import {ProductGallery} from '@/features/product/components/ProductGallery';
import {SpecSheet, type SpecRow} from '@/features/product/components/SpecSheet';
import {VariantSheet} from '@/features/product/components/VariantSheet';
import {Breadcrumbs} from '@/features/collection/components/Breadcrumbs';
import {ProductRail} from '@/features/home/components/ProductRail';
import {useWishlist, useCompare} from '@/features/wishlist/store';
import {useTranslations} from '@/i18n';
import {
    findVariant,
    initialSelection,
    stockState,
    type Selection,
} from '@/features/product/variant-selection';
import {S, tr} from '@/features/catalogue-strings';

/**
 * Product detail.
 *
 * Order of the page is the order of the decision: image, name, price, stock,
 * variant, CTA, then the reference material (specs, description, related). A
 * spec sheet above the price would be thorough and useless; a customer who
 * cannot see what it costs does not read the datasheet.
 *
 * `GetProductDetailQuery` does not select a currency on the variant — the
 * channel is DZD-only (verified, see AGENTS.md) — so the code is a constant
 * here rather than a guess per variant. TODO: read it from the channel query
 * when multi-currency lands.
 */
const CURRENCY = 'DZD';

/** Facet-style rows are not in the detail document yet, so specs come from the
 * variant's own attributes: SKU, option values and stock. Real facets land with
 * the facet work on the search side. */
export default function ProductScreen() {
    const {slug} = useLocalSearchParams<{slug: string}>();
    const {data: product, isPending, error, refetch} = useProduct(slug);

    const [selection, setSelection] = useState<Selection | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [added, setAdded] = useState(false);

    const addToCart = useAddToCart();
    const wishlist = useWishlist();
    const compare = useCompare();
    const tWishlist = useTranslations('Wishlist');
    const tCompare = useTranslations('Compare');
    const tProduct = useTranslations('Product');

    const groups = useMemo(
        () => (product ? getDisplayOptionGroups(product) : []),
        [product],
    );

    const variants = product?.variants ?? [];

    const resolvedSelection = selection ?? (product ? initialSelection(variants) : {});

    const variant =
        variants.length === 1
            ? variants[0]
            : findVariant(variants, resolvedSelection, groups.length) ?? variants[0] ?? null;

    const state = stockState(variant?.stockLevel);
    const outOfStock = state === 'out-of-stock';

    // Related products: the first real collection this product sits in. It is a
    // second query rather than a field on the product, because "related" here
    // means "the rest of this category", which only the search index knows.
    const relatedSlug = product?.collections?.find(c => c.slug)?.slug;
    const related = useCollection(relatedSlug, {take: 10});
    const relatedProducts = related.data?.products.filter(
        item => 'productId' in item,
    );

    const onAdd = useCallback(() => {
        if (!variant) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        addToCart.mutate(
            {variantId: variant.id, quantity: 1},
            {
                onSuccess: () => {
                    setAdded(true);
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setTimeout(() => setAdded(false), 1600);
                },
                onError: () => {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                },
            },
        );
    }, [variant, addToCart]);

    /**
     * The payload both lists store. Enough to render a card offline (name,
     * price, image) without refetching, which is the point of a device-local
     * list.
     */
    const savedPayload = useMemo(
        () =>
            product && variant
                ? {
                      slug: product.slug,
                      name: product.name,
                      priceWithTax: variant.priceWithTax,
                      currencyCode: CURRENCY,
                      imageUrl: product.assets?.[0]?.preview ?? null,
                  }
                : null,
        [product, variant],
    );

    const savedInWishlist = product ? wishlist.has(product.slug) : false;
    const inCompare = product ? compare.has(product.slug) : false;

    const onToggleWishlist = useCallback(() => {
        if (!savedPayload) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        wishlist.toggle(savedPayload);
    }, [savedPayload, wishlist]);

    const onToggleCompare = useCallback(() => {
        if (!savedPayload) return;
        const result = compare.toggle(savedPayload);
        // Compare holds four products; silently ignoring a fifth tap looks
        // broken, so say why nothing happened.
        if (result.atLimit) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(tCompare('limitTitle'), tCompare('limitMessage'));
            return;
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [savedPayload, compare, tCompare]);

    const specs: SpecRow[] = useMemo(() => {
        if (!variant) return [];
        const rows: SpecRow[] = [{label: S.sku, value: variant.sku}];
        for (const option of variant.options) {
            const group = groups.find(candidate => candidate.id === option.groupId);
            rows.push({label: group?.name ?? option.name, value: option.name});
        }
        rows.push({
            label: tr('Filters.availability'),
            value: outOfStock ? S.outOfStock : state === 'low-stock' ? S.lowStock : S.inStock,
        });
        if (product?.customFields?.averageRating != null) {
            rows.push({
                // Compare.rating rather than a Product key: the spec sheet and
                // the compare table are the same kind of row and should read
                // identically.
                label: tr('Compare.rating'),
                value: `${product.customFields.averageRating.toFixed(1)} / 5`,
            });
        }
        if (variants.length > 1) {
            rows.push({label: tr('Compare.variants'), value: String(variants.length)});
        }
        return rows;
    }, [variant, outOfStock, state, product, variants.length, groups]);

    if (error) {
        return (
            <Screen>
                <NavBar />
                <EmptyState
                    tone="error"
                    icon="offline"
                    title={S.serverUnreachableTitle}
                    message={error.message}
                    action={{label: S.tryAgain, onPress: () => void refetch()}}
                />
            </Screen>
        );
    }

    if (isPending) {
        return (
            <Screen>
                <NavBar />
                <View style={styles.loading}>
                    <Skeleton width="100%" height={280} radius="none" />
                    <View style={styles.loadingBody}>
                        <Skeleton height={24} width="80%" />
                        <Skeleton height={28} width="40%" />
                        <Skeleton height={44} />
                    </View>
                </View>
            </Screen>
        );
    }

    if (!product) {
        return (
            <Screen>
                <NavBar />
                <EmptyState
                    title={S.noResults}
                    action={{label: S.viewAll, onPress: () => router.push('/shop')}}
                />
            </Screen>
        );
    }

    return (
        <Screen>
            <NavBar />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <ProductGallery images={product.assets} />

                <View style={styles.head}>
                    <Breadcrumbs items={product.collections?.[0]?.breadcrumbs ?? []} />

                    <View style={styles.titleBlock}>
                        <Text variant="title">{product.name}</Text>

                        <View style={styles.priceRow}>
                            {variant ? (
                                <Price
                                    value={variant.priceWithTax}
                                    currencyCode={CURRENCY}
                                    size="lg"
                                    tone={outOfStock ? 'textMuted' : 'brand'}
                                />
                            ) : null}

                            <Badge
                                tone={
                                    outOfStock
                                        ? 'neutral'
                                        : state === 'low-stock'
                                          ? 'sale'
                                          : 'success'
                                }
                            >
                                {outOfStock ? S.outOfStock : state === 'low-stock' ? S.lowStock : S.inStock}
                            </Badge>
                        </View>

                        {variant ? (
                            <Text variant="micro" color="textMuted" tabular>
                                {`${S.sku} ${variant.sku}`}
                            </Text>
                        ) : null}
                    </View>

                    {groups.length > 0 && variants.length > 1 ? (
                        <View style={styles.variantTrigger}>
                            <Button
                                variant="secondary"
                                fullWidth
                                iconEnd="chevronDown"
                                onPress={() => setSheetOpen(true)}
                            >
                                {variant ? variant.name : S.selectOptions}
                            </Button>
                        </View>
                    ) : null}

                    <View style={styles.cta}>
                        <Button
                            variant="primary"
                            size="lg"
                            fullWidth
                            icon={added ? 'check' : 'cart'}
                            disabled={!variant || outOfStock}
                            loading={addToCart.isPending}
                            onPress={onAdd}
                        >
                            {outOfStock
                                ? S.outOfStock
                                : added
                                  ? S.addedToCart
                                  : addToCart.isPending
                                    ? S.adding
                                    : S.addToCart}
                        </Button>

                        {/* Save and compare live beside the cart CTA rather
                            than in the header: they are secondary to buying,
                            but a wishlist nothing can add to is just a dead
                            screen, which is what shipped before this. */}
                        <View style={styles.secondaryActions}>
                            <Button
                                variant="secondary"
                                size="md"
                                icon={savedInWishlist ? 'heartFilled' : 'heart'}
                                onPress={onToggleWishlist}
                                accessibilityLabel={tWishlist('title')}
                            >
                                {savedInWishlist ? tWishlist('saved') : tWishlist('save')}
                            </Button>

                            <Button
                                variant="secondary"
                                size="md"
                                icon="compare"
                                onPress={onToggleCompare}
                                accessibilityLabel={tCompare('title')}
                            >
                                {inCompare ? tCompare('inCompare') : tCompare('addToCompare')}
                            </Button>
                        </View>

                        {addToCart.isError ? (
                            <View style={styles.errorRow}>
                                <IconSymbol name="error" size={16} color="danger" />
                                <Text variant="caption" color="danger">
                                    {S.failedAddToCart}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <Divider />

                {/* Specs before prose: this is a components catalogue, and the
                    table is what the buying decision is actually made on. */}
                <SpecSheet title={tProduct('specifications')} rows={specs} />

                {product.description ? (
                    <View style={styles.description}>
                        <Text variant="heading">{S.descriptionTitle}</Text>
                        <Text variant="body" color="textMuted">
                            {stripHtml(product.description)}
                        </Text>
                    </View>
                ) : null}

                <ProductRail
                    eyebrow={S.relatedEyebrow}
                    title={S.relatedProducts}
                    products={relatedProducts}
                    isLoading={related.isPending && Boolean(relatedSlug)}
                />
            </ScrollView>

            {groups.length > 0 && variants.length > 1 ? (
                <VariantSheet
                    open={sheetOpen}
                    onClose={() => setSheetOpen(false)}
                    groups={groups}
                    variants={variants}
                    selection={resolvedSelection}
                    onSelectionChange={setSelection}
                    currencyCode={CURRENCY}
                />
            ) : null}
        </Screen>
    );
}

function NavBar() {
    const tCommon = useTranslations('Common');

    return (
        <View style={styles.navBar}>
            {/* `chevronBack` is in the directional set, so it mirrors in RTL. */}
            <Button variant="ghost" size="sm" icon="chevronBack" onPress={() => router.back()}>
                {tCommon('back')}
            </Button>
        </View>
    );
}

/**
 * Vendure descriptions are HTML. A WebView for a paragraph of text would cost a
 * native view and a second layout pass, so tags are stripped and the text is
 * rendered natively. TODO: render rich text properly when the description
 * blocks are used for more than prose.
 */
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

const styles = StyleSheet.create(theme => ({
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.sm,
        paddingBottom: theme.spacing.xs,
    },
    content: {paddingBottom: theme.spacing['3xl']},
    loading: {gap: theme.spacing.lg},
    loadingBody: {paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md},
    head: {gap: theme.spacing.md, paddingTop: theme.spacing.md},
    titleBlock: {paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm},
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        flexWrap: 'wrap',
    },
    variantTrigger: {paddingHorizontal: theme.spacing.lg},
    secondaryActions: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    cta: {paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.lg},
    errorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    description: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.lg,
        gap: theme.spacing.sm,
    },
}));
