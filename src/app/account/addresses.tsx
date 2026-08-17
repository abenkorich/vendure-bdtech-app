import {useState} from 'react';
import {Alert, ScrollView, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Screen, Text, Button, Card, Badge, Skeleton, EmptyState, Sheet} from '@/components/ui';
import {useSession} from '@/features/auth/queries';
import {
    useAddresses,
    useCreateAddress,
    useUpdateAddress,
    useDeleteAddress,
    useAvailableCountries,
    type CustomerAddress,
} from '@/features/account/queries';
import {addressSchema} from '@/features/auth/schemas';
import {useForm} from '@/features/auth/use-form';
import {Field} from '@/features/account/components/Field';
import {
    BackHeader,
    ErrorBanner,
    FormBody,
    Segmented,
} from '@/features/account/components/chrome';
import {useT} from '@/features/account/i18n';

/**
 * Address book.
 *
 * Add/edit happens in a sheet rather than a pushed route: an address form is
 * short, and keeping the list visible behind it makes "which one am I editing"
 * unambiguous. Delete is confirmed and optimistic (the hook rolls back on
 * failure) because a row vanishing on tap is the clearest possible feedback.
 */
export default function AddressesScreen() {
    const t = useT('Account');
    const router = useRouter();
    const session = useSession();
    const addresses = useAddresses();
    const deleteAddress = useDeleteAddress();
    const [editing, setEditing] = useState<CustomerAddress | null | undefined>(undefined);

    if (!session.isLoading && !session.isSignedIn) {
        return (
            <Screen>
                <BackHeader title={t('addresses')} />
                <EmptyState
                    icon="lock"
                    title={t('addresses')}
                    message={t('manageAddresses')}
                    action={{label: t('quickAddresses'), onPress: () => router.replace('/auth/sign-in')}}
                />
            </Screen>
        );
    }

    const confirmDelete = (address: CustomerAddress) => {
        Alert.alert(t('deleteConfirmTitle'), t('deleteConfirmDescription'), [
            {text: t('cancel'), style: 'cancel'},
            {
                text: t('delete'),
                style: 'destructive',
                onPress: () => deleteAddress.mutate(address.id),
            },
        ]);
    };

    return (
        <Screen>
            <BackHeader
                title={t('addresses')}
                subtitle={t('manageAddresses')}
                trailing={
                    <Button size="sm" icon="add" onPress={() => setEditing(null)}>
                        {t('addNewAddress')}
                    </Button>
                }
            />

            {addresses.isPending ? (
                <View style={styles.list}>
                    <Skeleton height={140} radius="lg" />
                    <Skeleton height={140} radius="lg" />
                </View>
            ) : (addresses.data?.length ?? 0) === 0 ? (
                <EmptyState
                    icon="location"
                    title={t('noAddressesTitle')}
                    message={t('noAddressesSaved')}
                    action={{label: t('addFirstAddress'), onPress: () => setEditing(null)}}
                />
            ) : (
                <ScrollView contentContainerStyle={styles.list}>
                    {addresses.data?.map(address => (
                        <Card key={address.id} padding="lg" style={styles.card}>
                            <View style={styles.badges}>
                                {address.defaultShippingAddress ? (
                                    <Badge tone="brand">{t('defaultShipping')}</Badge>
                                ) : null}
                                {address.defaultBillingAddress ? (
                                    <Badge tone="neutral">{t('defaultBilling')}</Badge>
                                ) : null}
                            </View>

                            <Text variant="bodyStrong">{address.fullName}</Text>
                            {[
                                address.company,
                                address.streetLine1,
                                address.streetLine2,
                                [address.city, address.province].filter(Boolean).join(', '),
                                address.postalCode,
                                address.country.name,
                            ]
                                .filter(Boolean)
                                .map((row, index) => (
                                     
                                    <Text key={index} variant="caption" color="textMuted">
                                        {row}
                                    </Text>
                                ))}
                            {address.phoneNumber ? (
                                <Text variant="caption" color="textMuted" tabular>
                                    {address.phoneNumber}
                                </Text>
                            ) : null}

                            <View style={styles.actions}>
                                <Button size="sm" variant="secondary" icon="edit" onPress={() => setEditing(address)}>
                                    {t('edit')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    icon="trash"
                                    onPress={() => confirmDelete(address)}
                                >
                                    {t('delete')}
                                </Button>
                            </View>
                        </Card>
                    ))}
                </ScrollView>
            )}

            <Sheet
                open={editing !== undefined}
                onClose={() => setEditing(undefined)}
                title={editing ? t('editAddress') : t('addNewAddressDialog')}
                height={0.9}
            >
                {editing !== undefined ? (
                    <AddressForm address={editing} onDone={() => setEditing(undefined)} />
                ) : null}
            </Sheet>
        </Screen>
    );
}

/* ------------------------------------------------------------------- form */

function AddressForm({
    address,
    onDone,
}: {
    address: CustomerAddress | null;
    onDone: () => void;
}) {
    const t = useT('Account');
    const create = useCreateAddress();
    const update = useUpdateAddress();
    const countries = useAvailableCountries();

    // The channel is Algerian, so DZ is the sane default for a new address
    // rather than the first country alphabetically.
    const form = useForm(addressSchema, {
        fullName: address?.fullName ?? '',
        company: address?.company ?? '',
        streetLine1: address?.streetLine1 ?? '',
        streetLine2: address?.streetLine2 ?? '',
        city: address?.city ?? '',
        province: address?.province ?? '',
        postalCode: address?.postalCode ?? '',
        countryCode: address?.country.code ?? 'DZ',
        phoneNumber: address?.phoneNumber ?? '',
    });

    const [defaults, setDefaults] = useState({
        shipping: address?.defaultShippingAddress ?? false,
        billing: address?.defaultBillingAddress ?? false,
    });

    const pending = create.isPending || update.isPending;
    const error = create.error ?? update.error;

    const onSubmit = () => {
        const parsed = form.submit();
        if (!parsed) return;

        const input = {
            fullName: parsed.fullName,
            company: parsed.company || undefined,
            streetLine1: parsed.streetLine1,
            streetLine2: parsed.streetLine2 || undefined,
            city: parsed.city,
            province: parsed.province,
            postalCode: parsed.postalCode,
            countryCode: parsed.countryCode,
            phoneNumber: parsed.phoneNumber,
            defaultShippingAddress: defaults.shipping,
            defaultBillingAddress: defaults.billing,
        };

        if (address) update.mutate({id: address.id, ...input}, {onSuccess: onDone});
        else create.mutate(input, {onSuccess: onDone});
    };

    const countryOptions = (countries.data ?? []).slice(0, 60);

    return (
        <FormBody>
            <ErrorBanner error={error} />

            <Field
                label={t('fullName')}
                value={form.values.fullName}
                onChangeText={value => form.setValue('fullName', value)}
                onBlur={() => form.blur('fullName')}
                error={form.errors.fullName}
                autoComplete="name"
            />
            <Field
                label={t('company')}
                value={form.values.company}
                onChangeText={value => form.setValue('company', value)}
                onBlur={() => form.blur('company')}
                error={form.errors.company}
            />
            <Field
                label={t('streetAddress')}
                value={form.values.streetLine1}
                onChangeText={value => form.setValue('streetLine1', value)}
                onBlur={() => form.blur('streetLine1')}
                error={form.errors.streetLine1}
                autoComplete="street-address"
            />
            <Field
                label={t('apartment')}
                value={form.values.streetLine2}
                onChangeText={value => form.setValue('streetLine2', value)}
                onBlur={() => form.blur('streetLine2')}
                error={form.errors.streetLine2}
            />
            <View style={styles.row}>
                <Field
                    containerStyle={styles.rowItem}
                    label={t('city')}
                    value={form.values.city}
                    onChangeText={value => form.setValue('city', value)}
                    onBlur={() => form.blur('city')}
                    error={form.errors.city}
                />
                <Field
                    containerStyle={styles.rowItem}
                    label={t('stateProvince')}
                    value={form.values.province}
                    onChangeText={value => form.setValue('province', value)}
                    onBlur={() => form.blur('province')}
                    error={form.errors.province}
                />
            </View>
            <View style={styles.row}>
                <Field
                    containerStyle={styles.rowItem}
                    label={t('postalCode')}
                    tabular
                    keyboardType="number-pad"
                    value={form.values.postalCode}
                    onChangeText={value => form.setValue('postalCode', value)}
                    onBlur={() => form.blur('postalCode')}
                    error={form.errors.postalCode}
                />
                <Field
                    containerStyle={styles.rowItem}
                    label={t('phoneNumberField')}
                    tabular
                    keyboardType="phone-pad"
                    value={form.values.phoneNumber}
                    onChangeText={value => form.setValue('phoneNumber', value)}
                    onBlur={() => form.blur('phoneNumber')}
                    error={form.errors.phoneNumber}
                />
            </View>

            <View style={styles.field}>
                <Text variant="caption" color="textMuted">
                    {t('country')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chips}>
                        {countryOptions.map(country => (
                            <Button
                                key={country.code}
                                size="sm"
                                variant={form.values.countryCode === country.code ? 'primary' : 'secondary'}
                                onPress={() => form.setValue('countryCode', country.code)}
                            >
                                {country.name}
                            </Button>
                        ))}
                    </View>
                </ScrollView>
            </View>

            <Segmented
                label={t('setAsShipping')}
                value={defaults.shipping ? 'yes' : 'no'}
                onChange={value => setDefaults(d => ({...d, shipping: value === 'yes'}))}
                options={[
                    {value: 'no', label: t('cancel')},
                    {value: 'yes', label: t('setAsShipping')},
                ]}
            />
            <Segmented
                label={t('setAsBilling')}
                value={defaults.billing ? 'yes' : 'no'}
                onChange={value => setDefaults(d => ({...d, billing: value === 'yes'}))}
                options={[
                    {value: 'no', label: t('cancel')},
                    {value: 'yes', label: t('setAsBilling')},
                ]}
            />

            <Button fullWidth size="lg" loading={pending} onPress={onSubmit}>
                {address ? t('updateAddress') : t('saveAddress')}
            </Button>
        </FormBody>
    );
}

const styles = StyleSheet.create(theme => ({
    list: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.md,
    },
    card: {gap: theme.spacing.xs},
    badges: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
        marginBottom: theme.spacing.xs,
    },
    actions: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.sm,
    },
    row: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
    rowItem: {flex: 1},
    field: {gap: theme.spacing.xs},
    chips: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
    },
}));
