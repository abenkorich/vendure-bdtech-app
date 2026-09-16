import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, IconSymbol, formatPrice} from '@/components/ui';
import {useLocale, useTranslations} from '@/i18n';
import {couponArbitration, type OrderProductDiscountsLike} from '@/lib/order-discounts';

/**
 * Why a coupon, or the sale prices, give nothing on this order.
 *
 * A coupon that does not combine with sale prices (every coupon, unless the
 * merchant allows it) competes with them: the bigger saving applies, the other
 * gives nothing, and the coupon code stays on the order either way. Unexplained,
 * the cart shows a coupon chip beside a total it did not change, or sale prices
 * that went back to full price, and both read as a bug.
 */

export interface SaleCouponNoticeProps {
    productDiscounts: OrderProductDiscountsLike | null | undefined;
    currencyCode: string;
}

export function SaleCouponNotice({productDiscounts, currencyCode}: SaleCouponNoticeProps) {
    const t = useTranslations('ProductDiscounts');
    const {locale} = useLocale();
    const arbitration = couponArbitration(productDiscounts);

    if (!arbitration) return null;

    const message =
        arbitration.kind === 'couponWins'
            ? t('couponReplacesSale', {
                  amount: formatPrice(arbitration.potentialSavingWithTax, currencyCode, {locale}),
              })
            : t('couponNotCombined', {
                  count: arbitration.couponCodes.length,
                  codes: arbitration.couponCodes.join(', '),
              });

    return (
        <View style={styles.root}>
            <IconSymbol name="info" size={16} color="textMuted" />
            <Text variant="caption" color="textMuted" style={styles.message}>
                {message}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm},
    message: {flex: 1},
}));
