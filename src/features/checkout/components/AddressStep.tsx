import {useMemo, useState} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Button, Divider} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {Field} from '@/features/account/components/Field';
import {useSession} from '@/features/auth/queries';
import {useAddresses} from '@/features/account/queries';
import type {CustomerAddress, CheckoutOrder} from '@/lib/types';
import {presentError, type PresentedError} from '@/features/cart/errors';
import {ErrorBanner} from '@/features/cart/components/ErrorBanner';
import {useSetShippingAddress, type OrderAddressInput} from '../queries';
import {useProvinces, citiesOf} from '../geography';
import {Picker, type PickerOption} from './Picker';
import {OptionRow} from './OptionRow';

/**
 * Shipping address step.
 *
 * The country is fixed to Algeria and rendered as a read-only line rather than
 * a select: `availableCountries` returns exactly one entry (verified live), and
 * a one-option dropdown is a tap that can only produce the value it already
 * has.
 *
 * Wilaya and commune are pickers, never free text — see `geography.ts` for why
 * that is a correctness requirement here rather than a nicety. Changing the
 * wilaya clears the commune, because a commune from the previous wilaya is
 * silently wrong in a way nobody would notice until the parcel came back.
 *
 * Postal code is optional. Algerian addresses have one, but couriers route on
 * wilaya and commune, and making it required would block orders for the
 * (many) customers who do not know theirs.
 *
 * A signed-in customer sees their address book first, with the form behind an
 * "add new" toggle: picking a saved address is one tap, and re-typing it is
 * the thing that makes people abandon a checkout on a phone.
 */

export interface AddressStepProps {
    order: CheckoutOrder | null;
    onComplete: () => void;
}

const COUNTRY_CODE = 'DZ';

interface FormState {
    fullName: string;
    phoneNumber: string;
    streetLine1: string;
    streetLine2: string;
    province: string;
    city: string;
    postalCode: string;
}

function emptyForm(order: CheckoutOrder | null): FormState {
    const address = order?.shippingAddress;
    const customer = order?.customer;
    return {
        fullName:
            address?.fullName ??
            [customer?.firstName, customer?.lastName].filter(Boolean).join(' '),
        phoneNumber: address?.phoneNumber ?? customer?.phoneNumber ?? '',
        streetLine1: address?.streetLine1 ?? '',
        streetLine2: address?.streetLine2 ?? '',
        province: address?.province ?? '',
        city: address?.city ?? '',
        postalCode: address?.postalCode ?? '',
    };
}

function fromSavedAddress(address: CustomerAddress): FormState {
    return {
        fullName: address.fullName ?? '',
        phoneNumber: address.phoneNumber ?? '',
        streetLine1: address.streetLine1 ?? '',
        streetLine2: address.streetLine2 ?? '',
        province: address.province ?? '',
        city: address.city ?? '',
        postalCode: address.postalCode ?? '',
    };
}

export function AddressStep({order, onComplete}: AddressStepProps) {
    const t = useTranslations('Checkout');
    const session = useSession();
    const savedAddresses = useAddresses();
    const provinces = useProvinces(COUNTRY_CODE);
    const setShippingAddress = useSetShippingAddress();

    const addresses = session.isSignedIn ? (savedAddresses.data ?? []) : [];
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
        () => addresses.find(a => a.defaultShippingAddress)?.id ?? null,
    );
    // A guest has no book, so the form is the only thing there is to show.
    const [showForm, setShowForm] = useState(() => addresses.length === 0);

    const [form, setForm] = useState<FormState>(() => emptyForm(order));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [failure, setFailure] = useState<PresentedError | null>(null);

    const provinceOptions: PickerOption[] = useMemo(
        () =>
            (provinces.data ?? []).map(province => ({
                value: province.name,
                label: province.name,
            })),
        [provinces.data],
    );

    const cityOptions: PickerOption[] = useMemo(
        () =>
            citiesOf(provinces.data ?? [], form.province).map(city => ({
                value: city.name,
                label: city.name,
            })),
        [provinces.data, form.province],
    );

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm(current => ({...current, [key]: value}));
    };

    const validate = (): boolean => {
        const next: Record<string, string> = {};
        if (!form.fullName.trim()) next.fullName = t('fullNameRequired');
        if (!form.phoneNumber.trim()) next.phoneNumber = t('phoneRequired');
        if (!form.streetLine1.trim()) next.streetLine1 = t('streetRequired');
        if (!form.province.trim()) next.province = t('stateProvinceRequired');
        if (!form.city.trim()) next.city = t('cityRequired');
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const submit = (values: FormState) => {
        setFailure(null);
        const input: OrderAddressInput = {
            fullName: values.fullName.trim(),
            streetLine1: values.streetLine1.trim(),
            streetLine2: values.streetLine2.trim() || undefined,
            city: values.city.trim(),
            province: values.province.trim(),
            postalCode: values.postalCode.trim() || undefined,
            countryCode: COUNTRY_CODE,
            phoneNumber: values.phoneNumber.trim(),
        };

        setShippingAddress.mutate(
            {address: input, useSameForBilling: true},
            {
                onSuccess: onComplete,
                onError: caught => setFailure(presentError(caught)),
            },
        );
    };

    const handleSubmitForm = () => {
        if (!validate()) return;
        submit(form);
    };

    const handleUseSaved = () => {
        const address = addresses.find(a => a.id === selectedAddressId);
        if (!address) return;
        submit(fromSavedAddress(address));
    };

    return (
        <View style={styles.root}>
            {failure ? (
                <ErrorBanner error={failure} onDismiss={() => setFailure(null)} />
            ) : null}

            {addresses.length > 0 && !showForm ? (
                <View style={styles.saved}>
                    <Text variant="caption" color="textMuted">
                        {t('selectSavedAddress')}
                    </Text>

                    {addresses.map(address => (
                        <OptionRow
                            key={address.id}
                            selected={address.id === selectedAddressId}
                            onPress={() => setSelectedAddressId(address.id)}
                            icon="location"
                            title={address.fullName ?? address.streetLine1}
                            description={[
                                address.streetLine1,
                                address.city,
                                address.province,
                            ]
                                .filter(Boolean)
                                .join(', ')}
                        />
                    ))}

                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        disabled={!selectedAddressId}
                        loading={setShippingAddress.isPending}
                        onPress={handleUseSaved}
                    >
                        {t('continueWithSelected')}
                    </Button>

                    <Divider />

                    <Button variant="ghost" icon="add" onPress={() => setShowForm(true)}>
                        {t('addNewAddress')}
                    </Button>
                </View>
            ) : (
                <>
                    <Field
                        label={t('fullName')}
                        value={form.fullName}
                        onChangeText={value => set('fullName', value)}
                        error={errors.fullName}
                        autoComplete="name"
                        textContentType="name"
                    />

                    <Field
                        label={t('phoneNumber')}
                        icon="phone"
                        value={form.phoneNumber}
                        onChangeText={value => set('phoneNumber', value)}
                        error={errors.phoneNumber}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        tabular
                    />

                    <Field
                        label={t('streetAddress')}
                        value={form.streetLine1}
                        onChangeText={value => set('streetLine1', value)}
                        error={errors.streetLine1}
                        autoComplete="street-address"
                    />

                    <Field
                        label={t('apartment')}
                        value={form.streetLine2}
                        onChangeText={value => set('streetLine2', value)}
                    />

                    <Picker
                        label={t('stateProvince')}
                        placeholder={t('selectProvince')}
                        value={form.province || null}
                        options={provinceOptions}
                        loading={provinces.isPending}
                        error={errors.province}
                        onChange={value => {
                            // A commune belongs to exactly one wilaya; keeping
                            // the old one would produce a plausible-looking,
                            // undeliverable address.
                            setForm(current => ({...current, province: value, city: ''}));
                        }}
                        emptyMessage={t('noProvinces')}
                        searchPlaceholder={t('searchProvince')}
                        noMatchMessage={t('noProvincesMatch')}
                    />

                    <Picker
                        label={t('city')}
                        placeholder={
                            form.province ? t('selectCommune') : t('selectProvinceFirst')
                        }
                        value={form.city || null}
                        options={cityOptions}
                        disabled={!form.province}
                        error={errors.city}
                        onChange={value => set('city', value)}
                        emptyMessage={t('noCommunes')}
                        searchPlaceholder={t('searchCommune')}
                        noMatchMessage={t('noCommunesMatch')}
                    />

                    <Field
                        label={t('postalCodeOptional')}
                        value={form.postalCode}
                        onChangeText={value => set('postalCode', value)}
                        keyboardType="number-pad"
                        tabular
                    />

                    <View style={styles.countryRow}>
                        <Text variant="caption" color="textMuted">
                            {t('country')}
                        </Text>
                        <Text variant="caption">{t('algeria')}</Text>
                    </View>

                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        loading={setShippingAddress.isPending}
                        onPress={handleSubmitForm}
                    >
                        {t('continue')}
                    </Button>

                    {addresses.length > 0 ? (
                        <Button variant="ghost" onPress={() => setShowForm(false)}>
                            {t('cancel')}
                        </Button>
                    ) : null}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.md},
    saved: {gap: theme.spacing.md},
    countryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.xs,
    },
}));
