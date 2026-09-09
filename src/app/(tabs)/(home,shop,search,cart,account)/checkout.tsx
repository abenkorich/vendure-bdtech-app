import {useCallback, useMemo, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Screen, Text, Card, Skeleton, EmptyState, Button} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {useCheckoutOrder} from '@/features/cart/queries';
import {useSession} from '@/features/auth/queries';
import {useEligiblePaymentMethods} from '@/features/checkout/queries';
import {BackHeader} from '@/features/account/components/chrome';
import {presentError} from '@/features/cart/errors';
import {ErrorBanner} from '@/features/cart/components/ErrorBanner';
import {StepSection, type StepState} from '@/features/checkout/components/StepSection';
import {ContactStep} from '@/features/checkout/components/ContactStep';
import {AddressStep} from '@/features/checkout/components/AddressStep';
import {DeliveryStep} from '@/features/checkout/components/DeliveryStep';
import {PaymentStep} from '@/features/checkout/components/PaymentStep';
import {ReviewStep} from '@/features/checkout/components/ReviewStep';
import {OrderSummary} from '@/features/checkout/components/OrderSummary';
import {plainDescription} from '@/features/checkout/delivery';
import {
    canAccessStep,
    isStepComplete,
    placeOrderBlockers,
    progressOf,
    resolveCurrentStep,
    stepsFor,
    nextStep,
    type CheckoutStep,
} from '@/features/checkout/steps';

/**
 * Checkout.
 *
 * One scrollable screen of collapsible steps rather than five routes — see
 * `features/checkout/components/StepSection.tsx` for why. The step machine
 * (`features/checkout/steps.ts`) is pure and derives everything from the order
 * itself, so this component holds exactly two pieces of state: which step the
 * user has *opened*, and which payment method they picked (the one choice
 * Vendure does not store on the order until it is paid).
 *
 * That is what makes going back safe. Re-opening the address step and changing
 * the wilaya drops the shipping line on the server, and the delivery and
 * payment steps become incomplete on the next render without any bookkeeping
 * here.
 *
 * The whole thing is inside a `KeyboardAvoidingView`: the address step is eight
 * fields tall, and on a phone the "Continue" button under them sits exactly
 * where the keyboard lands.
 */
export default function CheckoutScreen() {
    const t = useTranslations('Checkout');
    const router = useRouter();

    const {data: order, isPending, error, refetch} = useCheckoutOrder();
    const session = useSession();

    const [openStep, setOpenStep] = useState<CheckoutStep | null>(null);
    const [paymentMethodCode, setPaymentMethodCode] = useState<string | null>(null);

    const isGuest = !session.isSignedIn;
    const steps = useMemo(() => stepsFor(isGuest), [isGuest]);
    const progress = useMemo(
        () => progressOf(order, paymentMethodCode),
        [order, paymentMethodCode],
    );

    // The furthest step the order justifies, unless the user opened an earlier
    // one to change something.
    const derivedStep = resolveCurrentStep(steps, progress);
    const currentStep =
        openStep && canAccessStep(openStep, steps, progress) ? openStep : derivedStep;

    // Payment names come from the same eligible list the payment step renders,
    // so the review summary cannot show a method the backend does not offer.
    const paymentMethods = useEligiblePaymentMethods(progress.hasShippingMethod);
    const paymentMethodName =
        paymentMethods.data?.find(method => method.code === paymentMethodCode)?.name ?? null;

    const advance = useCallback(
        (from: CheckoutStep) => {
            setOpenStep(nextStep(from, steps));
        },
        [steps],
    );

    if (isPending) {
        return (
            <Screen>
                <BackHeader title={t('pageTitle')} />
                <View style={styles.content}>
                    <Skeleton height={64} radius="lg" />
                    <Skeleton height={64} radius="lg" />
                    <Skeleton height={64} radius="lg" />
                    <Skeleton height={180} radius="lg" />
                </View>
            </Screen>
        );
    }

    if (error) {
        const presented = presentError(error);
        return (
            <Screen>
                <BackHeader title={t('pageTitle')} />
                <View style={styles.centered}>
                    <EmptyState
                        tone="error"
                        title={
                            presented.retryable
                                ? t('serverUnreachableTitle')
                                : t('unexpectedError')
                        }
                        message={presented.message}
                        action={{label: t('tryAgain'), onPress: () => void refetch()}}
                    />
                </View>
            </Screen>
        );
    }

    if (!order || order.lines.length === 0) {
        return (
            <Screen>
                <BackHeader title={t('pageTitle')} />
                <View style={styles.centered}>
                    <EmptyState
                        icon="cart"
                        title={t('cartEmpty')}
                        message={t('cartEmptyMessage')}
                        action={{
                            label: t('cartEmptyShop'),
                            onPress: () => router.replace('/shop'),
                        }}
                    />
                </View>
            </Screen>
        );
    }

    const stateOf = (step: CheckoutStep): StepState => {
        if (step === currentStep) return 'open';
        if (isStepComplete(step, progress)) return 'complete';
        return canAccessStep(step, steps, progress) ? 'complete' : 'locked';
    };

    const shippingLine = order.shippingLines?.[0];
    const address = order.shippingAddress;

    const summaries: Partial<Record<CheckoutStep, string | undefined>> = {
        contact: order.customer?.emailAddress ?? undefined,
        address: address?.streetLine1
            ? [address.streetLine1, address.city, address.province]
                  .filter(Boolean)
                  .join(', ')
            : undefined,
        delivery: shippingLine
            ? [
                  shippingLine.shippingMethod.name,
                  plainDescription(shippingLine.shippingMethod.description),
              ]
                  .filter(Boolean)
                  .join(' · ')
            : undefined,
        payment: paymentMethodName ?? undefined,
    };

    const titles: Record<CheckoutStep, string> = {
        contact: t('contactInformation'),
        address: t('shippingAddress'),
        delivery: t('deliveryMethod'),
        payment: t('paymentMethod'),
        review: t('reviewAndPlaceOrder'),
    };

    return (
        <Screen>
            <BackHeader title={t('pageTitle')} />

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    showsVerticalScrollIndicator={false}
                >
                    {session.error ? (
                        <ErrorBanner
                            error={presentError(session.error)}
                            onRetry={() => void session.refetch()}
                        />
                    ) : null}

                    {steps.map((step, index) => (
                        <StepSection
                            key={step}
                            index={index + 1}
                            title={titles[step]}
                            state={stateOf(step)}
                            summary={summaries[step]}
                            onPress={() => setOpenStep(step)}
                        >
                            {step === 'contact' ? (
                                <ContactStep
                                    initialEmail={order.customer?.emailAddress}
                                    initialFirstName={order.customer?.firstName}
                                    initialLastName={order.customer?.lastName}
                                    initialPhone={order.customer?.phoneNumber}
                                    onComplete={() => advance('contact')}
                                />
                            ) : step === 'address' ? (
                                <AddressStep order={order} onComplete={() => advance('address')} />
                            ) : step === 'delivery' ? (
                                <DeliveryStep
                                    currencyCode={order.currencyCode}
                                    selectedMethodId={shippingLine?.shippingMethod.id ?? null}
                                    addressReady={progress.hasShippingAddress}
                                    onComplete={() => advance('delivery')}
                                />
                            ) : step === 'payment' ? (
                                <PaymentStep
                                    selectedCode={paymentMethodCode}
                                    onSelect={setPaymentMethodCode}
                                    deliveryReady={progress.hasShippingMethod}
                                    onComplete={() => advance('payment')}
                                />
                            ) : (
                                <ReviewStep
                                    order={order}
                                    paymentMethodName={paymentMethodName}
                                    paymentMethodCode={paymentMethodCode}
                                    blockers={placeOrderBlockers(progress)}
                                    onEditStep={setOpenStep}
                                    onPlaced={code => router.replace(`/order/${code}`)}
                                />
                            )}
                        </StepSection>
                    ))}

                    <Card variant="raised" padding="lg">
                        <OrderSummary order={order} />
                    </Card>

                    <View style={styles.backToCart}>
                        <Text variant="micro" color="textMuted">
                            {t('needChanges')}
                        </Text>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="cart"
                            onPress={() => router.replace('/cart')}
                        >
                            {t('placeOrderGoToCart')}
                        </Button>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    flex: {flex: 1},
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.md,
    },
    centered: {flex: 1, justifyContent: 'center'},
    backToCart: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        flexWrap: 'wrap',
    },
}));
