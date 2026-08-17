import {useState} from 'react';
import {Alert, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import * as Haptics from 'expo-haptics';
import {Text, Button, Divider} from '@/components/ui';
import {useTranslations} from '@/i18n';
import type {CheckoutOrder} from '@/lib/types';
import {presentError, type PresentedError} from '@/features/cart/errors';
import {ErrorBanner} from '@/features/cart/components/ErrorBanner';
import {usePlaceOrder, PlaceOrderError} from '../place-order';
import {plainDescription} from '../delivery';
import type {CheckoutStep} from '../steps';

/**
 * Review step.
 *
 * The last screen before an irreversible action, so it does one job: show the
 * customer exactly what they are agreeing to. Contact, address, delivery,
 * payment, each with a jump back to the step that owns it — an "edit" that
 * scrolls to a different summary would be a lie.
 *
 * The total is not re-derived here. It is `order.totalWithTax` straight from
 * the server, rendered through `<Price>`, because the number on this screen is
 * the number a courier will ask for in cash at the customer's door and any
 * client-side arithmetic is a chance to disagree with the invoice.
 *
 * The confirm is behind a native alert. That is not the usual pattern in this
 * app (the cart deliberately removes without confirming), but the reasoning is
 * the opposite here: a mis-tapped removal costs one undo, and a mis-tapped
 * "place order" costs a real parcel dispatched to a real address with cash due
 * on it.
 */

export interface ReviewStepProps {
    order: CheckoutOrder;
    paymentMethodName: string | null;
    paymentMethodCode: string | null;
    blockers: readonly CheckoutStep[];
    onEditStep: (step: CheckoutStep) => void;
    onPlaced: (orderCode: string) => void;
}

export function ReviewStep({
    order,
    paymentMethodName,
    paymentMethodCode,
    blockers,
    onEditStep,
    onPlaced,
}: ReviewStepProps) {
    const t = useTranslations('Checkout');
    const placeOrder = usePlaceOrder();
    const [failure, setFailure] = useState<PresentedError | null>(null);

    const address = order.shippingAddress;
    const shippingLine = order.shippingLines?.[0];

    const blocked = blockers.length > 0;

    const runPlaceOrder = () => {
        if (!paymentMethodCode) return;
        setFailure(null);

        placeOrder.mutate(
            {paymentMethodCode},
            {
                onSuccess: placed => {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    onPlaced(placed.code);
                },
                onError: caught => {
                    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    // A PlaceOrderError already carries copy written for the
                    // customer ("these products are no longer available"), so
                    // it goes through verbatim rather than being flattened
                    // into "something went wrong".
                    setFailure(
                        caught instanceof PlaceOrderError
                            ? {message: caught.message, retryable: false}
                            : presentError(caught),
                    );
                },
            },
        );
    };

    const confirm = () => {
        Alert.alert(t('confirmOrderTitle'), t('confirmOrderMessage'), [
            {text: t('cancel'), style: 'cancel'},
            {text: t('placeOrder'), style: 'default', onPress: runPlaceOrder},
        ]);
    };

    return (
        <View style={styles.root}>
            {failure ? (
                <ErrorBanner error={failure} onDismiss={() => setFailure(null)} />
            ) : null}

            <SummaryBlock
                label={t('contact')}
                onEdit={() => onEditStep('contact')}
                editLabel={t('edit')}
                lines={[
                    [order.customer?.firstName, order.customer?.lastName]
                        .filter(Boolean)
                        .join(' '),
                    order.customer?.emailAddress ?? '',
                    order.customer?.phoneNumber ?? '',
                ]}
            />

            <Divider />

            <SummaryBlock
                label={t('shippingAddress')}
                onEdit={() => onEditStep('address')}
                editLabel={t('edit')}
                empty={!address ? t('noShippingAddress') : undefined}
                lines={
                    address
                        ? [
                              address.fullName ?? '',
                              address.streetLine1 ?? '',
                              address.streetLine2 ?? '',
                              [address.city, address.province].filter(Boolean).join(', '),
                              address.country ?? '',
                              address.phoneNumber ?? '',
                          ]
                        : []
                }
            />

            <Divider />

            <SummaryBlock
                label={t('deliveryMethod')}
                onEdit={() => onEditStep('delivery')}
                editLabel={t('edit')}
                empty={!shippingLine ? t('noDeliveryMethod') : undefined}
                lines={
                    shippingLine
                        ? [
                              shippingLine.shippingMethod.name,
                              plainDescription(shippingLine.shippingMethod.description),
                          ]
                        : []
                }
            />

            <Divider />

            <SummaryBlock
                label={t('paymentMethod')}
                onEdit={() => onEditStep('payment')}
                editLabel={t('edit')}
                empty={!paymentMethodName ? t('noPaymentMethod') : undefined}
                lines={paymentMethodName ? [paymentMethodName, t('codHint')] : []}
            />

            {blocked ? (
                <Text variant="micro" color="danger">
                    {t('completeAllSteps')}
                </Text>
            ) : null}

            <Button
                variant="primary"
                size="lg"
                fullWidth
                icon="lock"
                disabled={blocked || !paymentMethodCode}
                loading={placeOrder.isPending}
                onPress={confirm}
            >
                {t('placeOrder')}
            </Button>
        </View>
    );
}

function SummaryBlock({
    label,
    lines,
    empty,
    onEdit,
    editLabel,
}: {
    label: string;
    lines: readonly string[];
    empty?: string;
    onEdit: () => void;
    editLabel: string;
}) {
    const visible = lines.filter(line => line.trim().length > 0);

    return (
        <View style={styles.block}>
            <View style={styles.blockHeader}>
                <Text variant="caption" color="textMuted">
                    {label}
                </Text>
                <Button variant="ghost" size="sm" onPress={onEdit}>
                    {editLabel}
                </Button>
            </View>

            {empty ? (
                <Text variant="caption" color="danger">
                    {empty}
                </Text>
            ) : (
                visible.map((line, index) => (
                    <Text key={`${line}-${index}`} variant="caption">
                        {line}
                    </Text>
                ))
            )}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.md},
    block: {gap: theme.spacing.xs},
    blockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
}));
