import {useCallback} from 'react';
import {Alert, Pressable} from 'react-native';
import * as Haptics from 'expo-haptics';
import {StyleSheet} from 'react-native-unistyles';
import {IconSymbol, type ProductCardData} from '@/components/ui';
import {cardPriceDisplay} from '@/design/card-price';
import {useWishlist} from '@/features/wishlist/store';
import {useTranslations} from '@/i18n';

/**
 * The save-for-later heart on a product card.
 *
 * The card's own list is device-local (`features/wishlist/store`), so this
 * needs no account and works offline — which is the point: a shopper browsing
 * on the bus can keep a shortlist without being asked to sign up first.
 *
 * It stores enough to render the saved row without refetching — name, price,
 * image — because that is what makes the wishlist screen work with no
 * connection. The price taken is the one the card *shows*: `value` for a
 * single price, `min` for a range, the sale price when there is one, so a
 * saved row never quotes a figure the shopper never saw.
 *
 * Filled heart means saved. The list is capped, and a tap that hits the cap
 * says so rather than doing nothing — a silently ignored tap on a heart reads
 * as the button being broken.
 */
export interface WishlistButtonProps {
    product: ProductCardData;
}

export function WishlistButton({product}: WishlistButtonProps) {
    const t = useTranslations('Wishlist');
    const wishlist = useWishlist();
    const saved = wishlist.has(product.slug);

    const onPress = useCallback(() => {
        const result = wishlist.toggle({
            slug: product.slug,
            name: product.productName,
            priceWithTax: cardPriceDisplay(product).value,
            currencyCode: product.currencyCode,
            imageUrl: product.productAsset?.preview ?? null,
        });

        if (result.atLimit) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(t('limitTitle'), t('limitMessage', {count: wishlist.limit}));
            return;
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [product, wishlist, t]);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{selected: saved}}
            accessibilityLabel={saved ? t('saved') : t('save')}
            // Generous, because the button is small and sits in the corner of
            // a card that is itself tappable: a near-miss must not open the
            // product instead of saving it.
            hitSlop={10}
            onPress={onPress}
            style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}
        >
            <IconSymbol
                name={saved ? 'heartFilled' : 'heart'}
                size={18}
                color={saved ? 'sale' : 'textMuted'}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create(theme => ({
    button: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        // A plate, because the photo behind it is arbitrary: an outlined
        // heart on a white product shot would otherwise vanish.
        backgroundColor: theme.colors.surface,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    buttonPressed: {
        opacity: 0.7,
    },
}));
