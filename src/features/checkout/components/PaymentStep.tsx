import {useEffect, useMemo} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Button, Skeleton} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {presentError} from '@/features/cart/errors';
import {ErrorBanner} from '@/features/cart/components/ErrorBanner';
import {useEligiblePaymentMethods} from '../queries';
import {
    describePaymentMethod,
    isCustomerFacingPaymentMethod,
} from '../payment-methods';
import {OptionRow} from './OptionRow';

/**
 * Payment step.
 *
 * Cash on delivery is the only thing this store takes, and the eligible list
 * comes from the backend rather than being hard-coded, because *which* COD
 * method applies depends on the carrier chosen in the previous step
 * (`yalidine-cod` with a Yalidine parcel, `country-resident-cod` with in-store
 * pickup, and so on). Hard-coding "Cash on Delivery" here would attach a
 * payment method the carrier does not collect.
 *
 * SATIM (the Algerian card network) is deliberately **not** implemented. The
 * structure that makes adding it a one-file change lives in
 * `payment-methods.ts`: this component renders whatever the backend says is
 * eligible and asks the registry how to present it, so a card method appearing
 * on the backend shows up here with an icon and a `kind`, and only the
 * `redirect` branch in the review step's place-order path would be new.
 *
 * When exactly one method is eligible it is auto-selected. Making someone tap a
 * radio with no alternative is a step that exists only to be completed.
 */

export interface PaymentStepProps {
    selectedCode: string | null;
    onSelect: (code: string) => void;
    /** True once a shipping method is on the order — COD depends on it. */
    deliveryReady: boolean;
    onComplete: () => void;
}

export function PaymentStep({
    selectedCode,
    onSelect,
    deliveryReady,
    onComplete,
}: PaymentStepProps) {
    const t = useTranslations('Checkout');
    const methods = useEligiblePaymentMethods(deliveryReady);

    const list = useMemo(
        () => (methods.data ?? []).filter(method => isCustomerFacingPaymentMethod(method.code)),
        [methods.data],
    );

    useEffect(() => {
        if (list.length !== 1) return;
        const only = list[0];
        if (selectedCode === only.code) return;
        onSelect(only.code);
    }, [list, selectedCode, onSelect]);

    if (methods.isPending) {
        return (
            <View style={styles.root}>
                <Skeleton height={56} radius="md" />
                <Skeleton height={56} radius="md" />
            </View>
        );
    }

    if (methods.error) {
        return (
            <View style={styles.root}>
                <ErrorBanner
                    error={presentError(methods.error)}
                    onRetry={() => void methods.refetch()}
                />
            </View>
        );
    }

    if (list.length === 0) {
        return (
            <View style={styles.root}>
                <Text variant="caption" color="textMuted">
                    {t('noPaymentMethods')}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <View style={styles.methods}>
                {list.map(method => {
                    const presentation = describePaymentMethod(method.code);
                    return (
                        <OptionRow
                            key={method.code}
                            selected={method.code === selectedCode}
                            onPress={() => onSelect(method.code)}
                            icon={presentation.icon}
                            title={method.name}
                            description={
                                presentation.hintKey ? t(presentation.hintKey) : undefined
                            }
                        />
                    );
                })}
            </View>

            <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!selectedCode}
                onPress={onComplete}
            >
                {t('continueToReview')}
            </Button>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.md},
    methods: {gap: theme.spacing.sm},
}));
