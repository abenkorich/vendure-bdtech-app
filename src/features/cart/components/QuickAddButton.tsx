import {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, ActivityIndicator} from 'react-native';
import * as Haptics from 'expo-haptics';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {router} from 'expo-router';
import {IconSymbol, type ProductCardData} from '@/components/ui';
import {useAddToCart} from '@/features/cart/queries';
import {StockAlertSheet} from '@/features/product/stock-alert';
import {useTranslations} from '@/i18n';

/**
 * The round cart button on a product card.
 *
 * Green while the product can be bought, which makes the button itself the
 * availability signal a shopper scans a grid for.
 *
 * Out of stock it does not go grey and dead — it becomes an amber bell that
 * takes a back-in-stock alert, the same control the website's card shows.
 * That is the one moment a sold-out listing can still capture intent, and a
 * disabled button captures none of it.
 *
 * Adds the card's variant straight to the cart, with one exception: a price
 * *range* means the product has variants at different prices, so the tap
 * opens the product page to choose instead of silently adding whichever one
 * the search index preferred. Measured on this catalogue, 6% of products
 * carry several variants and a third of those share one price; for that
 * third the preferred variant is added, which is the same one the product
 * page pre-selects.
 */
export interface QuickAddButtonProps {
    product: ProductCardData;
}

const ADDED_MS = 1400;

export function QuickAddButton({product}: QuickAddButtonProps) {
    const {theme} = useUnistyles();
    const t = useTranslations('Product');
    const addToCart = useAddToCart();
    const [added, setAdded] = useState(false);
    const [notifyOpen, setNotifyOpen] = useState(false);
    /**
     * The sheet is mounted on first tap and stays. A grid can hold a lot of
     * sold-out cards, and mounting a `Sheet` per card costs two shared values,
     * two animated styles and a pan gesture each, before anyone has asked for
     * one. Keeping it after the first open is what buys the close animation:
     * unmounting on close would make the sheet vanish instead of sliding out.
     * Same trick as the captcha web view in `features/auth/captcha.tsx`.
     */
    const [notifyMounted, setNotifyMounted] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );

    const outOfStock = product.inStock === false;
    const isRange =
        'min' in product.priceWithTax &&
        'max' in product.priceWithTax &&
        product.priceWithTax.min !== product.priceWithTax.max;
    const variantId = product.productVariantId;
    const needsChoice = isRange || !variantId;

    const onPress = useCallback(() => {
        if (needsChoice) {
            router.push(`/product/${product.slug}`);
            return;
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        addToCart.mutate(
            {variantId: variantId as string, quantity: 1},
            {
                onSuccess: () => {
                    setAdded(true);
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    if (timer.current) clearTimeout(timer.current);
                    timer.current = setTimeout(() => setAdded(false), ADDED_MS);
                },
                onError: () => {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                },
            },
        );
    }, [needsChoice, product.slug, variantId, addToCart]);

    const busy = addToCart.isPending;

    if (outOfStock) {
        return (
            <>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('notifyMe')}
                    hitSlop={8}
                    onPress={() => {
                        setNotifyMounted(true);
                        setNotifyOpen(true);
                    }}
                    style={({pressed}) => [
                        styles.button,
                        styles.buttonNotify,
                        pressed && styles.buttonPressed,
                    ]}
                >
                    <IconSymbol name="bell" size={18} color="onNotify" />
                </Pressable>

                {notifyMounted ? (
                    <StockAlertSheet
                        open={notifyOpen}
                        onClose={() => setNotifyOpen(false)}
                        variantId={variantId}
                        productName={product.productName}
                    />
                ) : null}
            </>
        );
    }

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={needsChoice ? t('selectOptions') : t('addToCart')}
            accessibilityState={{busy}}
            disabled={busy}
            hitSlop={8}
            onPress={onPress}
            style={({pressed}) => [
                styles.button,
                added && styles.buttonAdded,
                pressed && styles.buttonPressed,
            ]}
        >
            {busy ? (
                <ActivityIndicator size="small" color={theme.colors.onBrand} />
            ) : (
                <IconSymbol name={added ? 'check' : 'cart'} size={18} color="onBrand" />
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create(theme => ({
    button: {
        width: 36,
        height: 36,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.success,
        alignItems: 'center',
        justifyContent: 'center',
        // Lifted, so it reads as a control sitting on the card rather than
        // part of its surface.
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.background,
    },
    buttonAdded: {
        backgroundColor: theme.colors.brand,
    },
    /**
     * Orange, between the green of "buy this" and the red of the out-of-stock
     * badge: this is not an error and it is not a purchase, it is the offer to
     * be told later. Same colour as the website's notify button.
     */
    buttonNotify: {
        backgroundColor: theme.colors.notify,
    },
    buttonPressed: {
        opacity: 0.85,
    },
}));
