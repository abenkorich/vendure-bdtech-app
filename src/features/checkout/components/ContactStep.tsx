import {useState} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Text, Button} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {Field} from '@/features/account/components/Field';
import {useSetCustomerForOrder} from '../queries';
import {presentError, type PresentedError} from '@/features/cart/errors';
import {ErrorBanner} from '@/features/cart/components/ErrorBanner';

/**
 * Contact step (guest checkout).
 *
 * Guest checkout is not a fallback here, it is the majority path: most orders
 * on this store are placed without an account, so this step is the *first*
 * thing in the flow and creating an account is never required to get past it.
 *
 * The phone number is required rather than optional, unlike the web
 * storefront's generic form. Every carrier this store uses (Yalidine, ZR
 * Express, DHD) calls before delivery, and a COD parcel with no reachable
 * number comes back to the warehouse.
 *
 * `EmailAddressConflictError` gets its own treatment: the address belongs to an
 * existing account, and the only useful next action is a link to sign in, not
 * a red message telling the customer their own email is wrong.
 */

export interface ContactStepProps {
    initialEmail?: string | null;
    initialFirstName?: string | null;
    initialLastName?: string | null;
    initialPhone?: string | null;
    onComplete: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactStep({
    initialEmail,
    initialFirstName,
    initialLastName,
    initialPhone,
    onComplete,
}: ContactStepProps) {
    const t = useTranslations('Checkout');
    const router = useRouter();
    const setCustomer = useSetCustomerForOrder();

    const [email, setEmail] = useState(initialEmail ?? '');
    const [firstName, setFirstName] = useState(initialFirstName ?? '');
    const [lastName, setLastName] = useState(initialLastName ?? '');
    const [phone, setPhone] = useState(initialPhone ?? '');

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [conflict, setConflict] = useState(false);
    const [failure, setFailure] = useState<PresentedError | null>(null);

    const validate = (): boolean => {
        const next: Record<string, string> = {};
        if (!email.trim()) next.email = t('emailRequired');
        else if (!EMAIL_PATTERN.test(email.trim())) next.email = t('invalidEmail');
        if (!firstName.trim()) next.firstName = t('firstNameRequired');
        if (!lastName.trim()) next.lastName = t('lastNameRequired');
        if (!phone.trim()) next.phone = t('phoneRequired');
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = () => {
        setConflict(false);
        setFailure(null);
        if (!validate()) return;

        setCustomer.mutate(
            {
                emailAddress: email.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phoneNumber: phone.trim(),
            },
            {
                onSuccess: onComplete,
                onError: caught => {
                    const presented = presentError(caught);
                    // The conflict is not an error the customer can fix in this
                    // form — it is a prompt to sign in.
                    if (/already exists|conflict/i.test(presented.message)) {
                        setConflict(true);
                        return;
                    }
                    setFailure(presented);
                },
            },
        );
    };

    return (
        <View style={styles.root}>
            {failure ? <ErrorBanner error={failure} onDismiss={() => setFailure(null)} /> : null}

            {conflict ? (
                <View style={styles.conflict}>
                    <Text variant="caption" color="text">
                        {t('emailConflict')}
                    </Text>
                    <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => router.push('/auth/sign-in')}
                    >
                        {t('emailConflictSignIn')}
                    </Button>
                </View>
            ) : null}

            <Field
                label={t('emailAddress')}
                icon="mail"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
            />

            <View style={styles.pair}>
                <Field
                    label={t('firstName')}
                    value={firstName}
                    onChangeText={setFirstName}
                    error={errors.firstName}
                    autoComplete="given-name"
                    textContentType="givenName"
                    containerStyle={styles.pairItem}
                />
                <Field
                    label={t('lastName')}
                    value={lastName}
                    onChangeText={setLastName}
                    error={errors.lastName}
                    autoComplete="family-name"
                    textContentType="familyName"
                    containerStyle={styles.pairItem}
                />
            </View>

            <Field
                label={t('phoneNumber')}
                icon="phone"
                value={phone}
                onChangeText={setPhone}
                error={errors.phone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                hint={t('phoneHint')}
                tabular
            />

            <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={setCustomer.isPending}
                onPress={handleSubmit}
            >
                {t('continue')}
            </Button>

            <View style={styles.signInRow}>
                <Text variant="micro" color="textMuted">
                    {t('alreadyHaveAccount')}
                </Text>
                <Button variant="ghost" size="sm" onPress={() => router.push('/auth/sign-in')}>
                    {t('signInLink')}
                </Button>
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.md},
    pair: {flexDirection: 'row', gap: theme.spacing.md},
    pairItem: {flex: 1},
    conflict: {
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.brand,
        backgroundColor: theme.colors.brandMuted,
        alignItems: 'flex-start',
    },
    signInRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        flexWrap: 'wrap',
    },
}));
