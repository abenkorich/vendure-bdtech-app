import {useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Button, Skeleton} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {Segmented} from '@/features/account/components/chrome';
import {presentError, type PresentedError} from '@/features/cart/errors';
import {ErrorBanner} from '@/features/cart/components/ErrorBanner';
import {
    useEligibleShippingMethods,
    useSetShippingMethod,
    useYalidinePickupCenters,
    useSetYalidinePickupCenter,
    useDhdPickupDesks,
    useSetDhdPickupDesk,
    type EligibleShippingMethod,
} from '../queries';
import {
    deliveryModeOf,
    groupDeliveryMethods,
    plainDescription,
    pickupCarrierOf,
    type DeliveryMode,
} from '../delivery';
import {OptionRow} from './OptionRow';
import {Picker, type PickerOption} from './Picker';

/**
 * Delivery step.
 *
 * Two decisions, in the order an Algerian customer makes them: **where** (a
 * courier's stop-desk, my door, or the shop counter) and then **which
 * carrier**. Presenting the six eligible methods as one flat list buries the
 * stop-desk options, which are typically 40% cheaper and are what most orders
 * actually use. See `delivery.ts`.
 *
 * The stop-desk centre is a third decision, and only Yalidine can persist one
 * (`setYalidinePickupCenter`). The centre is pre-selected from the backend's
 * suggestion for the wilaya, so the common case is already answered when the
 * picker appears.
 *
 * Switching *away* from a Yalidine stop-desk clears any centre already on the
 * order. Leaving a stale centre attached to a home delivery is invisible in the
 * UI and shows up in the warehouse.
 */

export interface DeliveryStepProps {
    currencyCode: string;
    /** Method already on the order, so re-opening the step is not a reset. */
    selectedMethodId: string | null;
    /** True once the address step has written an address to the order. */
    addressReady: boolean;
    onComplete: () => void;
}

export function DeliveryStep({
    currencyCode,
    selectedMethodId: initialMethodId,
    addressReady,
    onComplete,
}: DeliveryStepProps) {
    const t = useTranslations('Checkout');

    const methods = useEligibleShippingMethods(addressReady);
    const setShippingMethod = useSetShippingMethod();
    const setPickupCenter = useSetYalidinePickupCenter();
    const setPickupDesk = useSetDhdPickupDesk();

    const [methodId, setMethodId] = useState<string | null>(initialMethodId);
    const [mode, setMode] = useState<DeliveryMode | null>(null);
    const [centerId, setCenterId] = useState<number | null>(null);
    const [failure, setFailure] = useState<PresentedError | null>(null);
    const [centerError, setCenterError] = useState<string | null>(null);

    const list = useMemo(() => methods.data ?? [], [methods.data]);
    const groups = useMemo(() => groupDeliveryMethods(list), [list]);

    const selectedMethod: EligibleShippingMethod | undefined = list.find(
        method => method.id === methodId,
    );
    // Which carrier's pickup-point list this method draws from, if any.
    const pickupCarrier = pickupCarrierOf(selectedMethod?.code);
    const needsCenter = pickupCarrier != null;

    const centers = useYalidinePickupCenters(pickupCarrier === 'yalidine');
    const desks = useDhdPickupDesks(pickupCarrier === 'dhd');
    const pickupQuery = pickupCarrier === 'dhd' ? desks : centers;
    // DHD accounts without an office endpoint list the stop-desk cities instead.
    const desksAreCities = pickupCarrier === 'dhd' && Boolean(desks.data?.fromCommunes);

    // Seed the mode from whatever is already chosen, else the cheapest group,
    // which is stop-desk when the wilaya has one.
    const activeMode: DeliveryMode =
        mode ??
        (selectedMethod ? deliveryModeOf(selectedMethod.code) : (groups[0]?.mode ?? 'home'));

    const modeMethods = groups.find(group => group.mode === activeMode)?.methods ?? [];

    // A method chosen for a previous address may not exist in this list at all.
    useEffect(() => {
        if (methodId && !list.some(method => method.id === methodId)) {
            setMethodId(null);
        }
    }, [list, methodId]);

    // Switching carrier makes the previous carrier's id meaningless. Declared
    // *before* the adopt effect: on the render where the carrier changes both
    // fire, and the later one wins — clearing after adopting would drop the
    // suggestion the new carrier just supplied.
    useEffect(() => {
        setCenterId(null);
    }, [pickupCarrier]);

    // Adopt the backend's suggestion for the wilaya as the default pickup point.
    useEffect(() => {
        if (pickupCarrier === 'yalidine' && centers.data) {
            const {selectedCenterId, suggestedCenterId} = centers.data;
            setCenterId(current => current ?? selectedCenterId ?? suggestedCenterId ?? null);
            return;
        }
        if (pickupCarrier === 'dhd' && desks.data) {
            const {selectedDeskId, suggestedDeskId} = desks.data;
            setCenterId(current => current ?? selectedDeskId ?? suggestedDeskId ?? null);
        }
    }, [pickupCarrier, centers.data, desks.data]);

    const centerOptions: PickerOption[] = useMemo(() => {
        if (pickupCarrier === 'dhd') {
            return (desks.data?.desks ?? []).map(desk => ({
                value: String(desk.deskId),
                label: desk.name,
                detail: [desk.address, desk.communeName].filter(Boolean).join(' · '),
            }));
        }
        return (centers.data?.centers ?? []).map(center => ({
            value: String(center.centerId),
            label: center.name,
            detail: [center.address, center.communeName].filter(Boolean).join(' · '),
        }));
    }, [pickupCarrier, centers.data, desks.data]);

    const modeOptions = useMemo(
        () =>
            groups.map(group => ({
                value: group.mode,
                label:
                    group.mode === 'stopdesk'
                        ? t('modeStopdesk')
                        : group.mode === 'home'
                          ? t('modeHome')
                          : t('modePickup'),
            })),
        [groups, t],
    );

    const handleContinue = () => {
        setFailure(null);
        setCenterError(null);
        if (!methodId) return;

        // With no pickup points listed there is nothing to choose: a DHD
        // stop-desk parcel still ships (Ecotrack's create/order carries no desk
        // id), so an empty list must not trap the customer on this step.
        if (needsCenter && centerOptions.length > 0 && centerId == null) {
            setCenterError(t('pickupCenterRequired'));
            return;
        }

        setShippingMethod.mutate(methodId, {
            onError: caught => setFailure(presentError(caught)),
            onSuccess: () => {
                // Clearing a stale pickup point matters as much as setting a new
                // one — and switching carrier has to clear the other one's too.
                const onError = (caught: unknown) => setFailure(presentError(caught));
                setPickupCenter.mutate(pickupCarrier === 'yalidine' ? centerId : null, {
                    onError,
                    onSuccess: () => {
                        setPickupDesk.mutate(pickupCarrier === 'dhd' ? centerId : null, {
                            onSuccess: onComplete,
                            onError,
                        });
                    },
                });
            },
        });
    };

    if (methods.isPending) {
        return (
            <View style={styles.root}>
                <Skeleton height={44} radius="md" />
                <Skeleton height={56} radius="md" />
                <Skeleton height={56} radius="md" />
            </View>
        );
    }

    if (methods.error) {
        const presented = presentError(methods.error);
        return (
            <View style={styles.root}>
                <ErrorBanner error={presented} onRetry={() => void methods.refetch()} />
            </View>
        );
    }

    if (list.length === 0) {
        return (
            <View style={styles.root}>
                <Text variant="caption" color="textMuted">
                    {t('noShippingMethods')}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.root}>
            {failure ? (
                <ErrorBanner error={failure} onDismiss={() => setFailure(null)} />
            ) : null}

            {modeOptions.length > 1 ? (
                <Segmented
                    options={modeOptions}
                    value={activeMode}
                    label={t('deliveryMethod')}
                    onChange={next => {
                        setMode(next);
                        // The chosen carrier belongs to the previous mode.
                        setMethodId(null);
                        setCenterId(null);
                    }}
                />
            ) : null}

            <Text variant="micro" color="textMuted">
                {activeMode === 'stopdesk'
                    ? t('modeStopdeskHint')
                    : activeMode === 'home'
                      ? t('modeHomeHint')
                      : t('modePickupHint')}
            </Text>

            <View style={styles.methods}>
                {modeMethods.map(method => (
                    <OptionRow
                        key={method.id}
                        selected={method.id === methodId}
                        onPress={() => {
                            setMethodId(method.id);
                            setCenterId(null);
                        }}
                        icon={deliveryModeOf(method.code) === 'home' ? 'truck' : 'package'}
                        title={method.name}
                        description={plainDescription(method.description) || undefined}
                        priceWithTax={method.priceWithTax}
                        currencyCode={currencyCode}
                        priceLabel={method.priceWithTax === 0 ? t('free') : undefined}
                    />
                ))}
            </View>

            {needsCenter ? (
                <View style={styles.centerBlock}>
                    <Text variant="caption" color="textMuted">
                        {pickupCarrier === 'yalidine'
                            ? t('selectPickupCenterHint')
                            : desksAreCities
                              ? t('selectPickupCenterHintDhdCity')
                              : t('selectPickupCenterHintDhd')}
                    </Text>
                    <Picker
                        label={t('selectPickupCenter')}
                        placeholder={t('selectPickupCenter')}
                        value={centerId == null ? null : String(centerId)}
                        options={centerOptions}
                        loading={pickupQuery.isPending}
                        error={centerError}
                        onChange={value => {
                            setCenterError(null);
                            setCenterId(Number(value));
                        }}
                        emptyMessage={t('noPickupCenters')}
                        searchPlaceholder={t('searchPickupCenters')}
                        noMatchMessage={t('noPickupCentersMatch')}
                    />
                </View>
            ) : null}

            <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!methodId}
                loading={
                    setShippingMethod.isPending ||
                    setPickupCenter.isPending ||
                    setPickupDesk.isPending
                }
                onPress={handleContinue}
            >
                {t('continueToPayment')}
            </Button>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.md},
    methods: {gap: theme.spacing.sm},
    centerBlock: {gap: theme.spacing.sm},
}));
