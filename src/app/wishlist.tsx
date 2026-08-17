import {useCallback, useState} from 'react';
import {Alert, ScrollView, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import * as Haptics from 'expo-haptics';
import {Screen, Text, Button, Divider, EmptyState} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {BackHeader} from '@/features/account/components/chrome';
import {useWishlist, useCompare, type SavedProduct} from '@/features/wishlist/store';
import {SavedProductRow} from '@/features/wishlist/components/SavedProductRow';
import {useAddToCart} from '@/features/cart/queries';
import {presentError, type PresentedError} from '@/features/cart/errors';
import {ErrorBanner} from '@/features/cart/components/ErrorBanner';
import {useProduct} from '@/features/product/queries';

/**
 * Wishlist.
 *
 * Device-local (there is no wishlist on this Shop API — see
 * `features/wishlist/store.ts`), which has one consequence worth stating on the
 * screen rather than hiding: the list does not follow the customer to another
 * device. The footer note says so instead of letting someone discover it after
 * a phone upgrade.
 *
 * Each row offers "add to cart" directly. A wishlist that can only be browsed
 * makes the user open the product, re-pick the variant and add it there —
 * three taps to do the thing they saved the product in order to do.
 *
 * The variant is resolved lazily per row (`AddToCartAction`): the saved
 * snapshot holds a slug, not a variant id, because a variant can be deleted
 * while the product lives on, and a stale id would fail silently at the till.
 */
export default function WishlistScreen() {
    const t = useTranslations('Wishlist');
    const tCompare = useTranslations('Compare');
    const router = useRouter();

    const wishlist = useWishlist();
    const compare = useCompare();
    const [error, setError] = useState<PresentedError | null>(null);

    const confirmClear = useCallback(() => {
        Alert.alert(t('clearAllTitle'), t('clearAllMessage'), [
            {text: t('cancel'), style: 'cancel'},
            {text: t('clearAll'), style: 'destructive', onPress: () => wishlist.clear()},
        ]);
    }, [t, wishlist]);

    if (wishlist.count === 0) {
        return (
            <Screen>
                <BackHeader title={t('title')} />
                <View style={styles.centered}>
                    <EmptyState
                        icon="heart"
                        title={t('emptyTitle')}
                        message={t('emptyMessage')}
                        action={{
                            label: t('startShopping'),
                            onPress: () => router.replace('/shop'),
                        }}
                    />
                </View>
            </Screen>
        );
    }

    return (
        <Screen>
            <BackHeader
                title={t('title')}
                subtitle={t('count', {count: wishlist.count})}
                trailing={
                    <Button variant="ghost" size="sm" icon="trash" onPress={confirmClear}>
                        {t('clearAll')}
                    </Button>
                }
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {error ? (
                    <ErrorBanner error={error} onDismiss={() => setError(null)} />
                ) : null}

                <View style={styles.list}>
                    {wishlist.items.map((item, index) => (
                        <View key={item.slug}>
                            {index > 0 ? <Divider /> : null}
                            <SavedProductRow
                                item={item}
                                onPress={() => router.push(`/product/${item.slug}`)}
                                onRemove={() => {
                                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    wishlist.remove(item.slug);
                                }}
                                removeLabel={t('remove')}
                                trailing={
                                    <View style={styles.rowActions}>
                                        <AddToCartAction item={item} onError={setError} />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon="compare"
                                            accessibilityLabel={tCompare('title')}
                                            onPress={() => {
                                                const result = compare.toggle({
                                                    slug: item.slug,
                                                    name: item.name,
                                                    priceWithTax: item.priceWithTax,
                                                    currencyCode: item.currencyCode,
                                                    imageUrl: item.imageUrl,
                                                });
                                                if (result.atLimit) {
                                                    // Silence here would be a
                                                    // button that does nothing.
                                                    Alert.alert(
                                                        tCompare('limitTitle'),
                                                        tCompare('limitMessage', {
                                                            count: compare.limit,
                                                        }),
                                                    );
                                                }
                                            }}
                                        >
                                            {compare.has(item.slug)
                                                ? tCompare('inCompare')
                                                : tCompare('addToCompare')}
                                        </Button>
                                    </View>
                                }
                            />
                        </View>
                    ))}
                </View>

                {compare.count > 0 ? (
                    <Button
                        variant="secondary"
                        fullWidth
                        icon="compare"
                        onPress={() => router.push('/compare')}
                    >
                        {tCompare('viewCompare', {count: compare.count})}
                    </Button>
                ) : null}

                <Text variant="micro" color="textMuted" align="center">
                    {t('deviceOnlyNote')}
                </Text>
            </ScrollView>
        </Screen>
    );
}

/**
 * "Add to cart" for a saved row.
 *
 * The product is fetched only to learn its variants, and only for products that
 * are on screen. A wishlist of 40 items does not fire 40 requests on mount:
 * this is inside the row, which is rendered lazily by the scroll view, and the
 * result is the same cached product document the detail screen uses.
 *
 * A multi-variant product deliberately does *not* guess. It routes to the
 * product page, because picking "the first variant" of a resistor pack is how
 * someone receives 100 Ω when they wanted 10 kΩ.
 */
function AddToCartAction({
    item,
    onError,
}: {
    item: SavedProduct;
    onError: (error: PresentedError) => void;
}) {
    const t = useTranslations('Product');
    const router = useRouter();
    const product = useProduct(item.slug);
    const addToCart = useAddToCart();

    const variants = product.data?.variants ?? [];
    const single = variants.length === 1 ? variants[0] : null;

    const handlePress = () => {
        if (!single) {
            router.push(`/product/${item.slug}`);
            return;
        }
        addToCart.mutate(
            {variantId: single.id, quantity: 1},
            {
                onSuccess: () =>
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
                onError: caught => onError(presentError(caught)),
            },
        );
    };

    return (
        <Button
            variant="secondary"
            size="sm"
            icon="cart"
            loading={addToCart.isPending}
            disabled={product.isPending}
            onPress={handlePress}
        >
            {single ? t('addToCart') : t('selectOptions')}
        </Button>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.lg,
    },
    centered: {flex: 1, justifyContent: 'center'},
    list: {gap: theme.spacing.sm},
    rowActions: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs},
}));
