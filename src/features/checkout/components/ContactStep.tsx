import {useMemo, useState} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Text, Button} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {useT} from '@/features/account/i18n';
import {Field} from '@/features/account/components/Field';
import {PhoneField} from '@/features/account/components/PhoneField';
import {createContactSchema} from '@/features/auth/schemas';
import {useForm} from '@/features/auth/use-form';
import {countryFromE164, type CallingCountry} from '@/lib/phone-number';
import {displayCustomerEmail, guestEmailFromPhone, joinFullName, splitFullName} from '@/lib/contact-details';
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
 * It asks for one name, then a mobile, then an email — the same order and the
 * same "either one will do" rule as sign-up and as the website, so a customer
 * who has done this once anywhere recognises it. Note what that costs: a
 * customer who leaves the mobile blank cannot be called, and every carrier
 * this store uses (Yalidine, ZR Express, DHD) calls before delivery, so a COD
 * parcel with no number risks coming back to the warehouse. The hint says so
 * rather than the form refusing, because a blocked checkout loses the order
 * outright. Making the mobile mandatory again is one word — drop `.optional()`
 * from `contactFields` — if the returns tell a different story.
 *
 * Vendure needs an `emailAddress`, so a mobile-only customer is given the same
 * synthetic one the website's backend already recognises; the order then
 * carries a real phone number and no fake address is ever shown back.
 *
 * `EmailAddressConflictError` gets its own treatment: the address belongs to
 * an existing account, and the only useful next action is a link to sign in,
 * not a red message telling the customer their own email is wrong.
 */

export interface ContactStepProps {
    initialEmail?: string | null;
    initialFirstName?: string | null;
    initialLastName?: string | null;
    initialPhone?: string | null;
    onComplete: () => void;
}

export function ContactStep({
    initialEmail,
    initialFirstName,
    initialLastName,
    initialPhone,
    onComplete,
}: ContactStepProps) {
    const t = useTranslations('Checkout');
    const tAuth = useT('Auth');
    const router = useRouter();
    const setCustomer = useSetCustomerForOrder();

    // A number already on the order was stored in E.164, so its country is
    // read back from the prefix rather than assumed.
    const [country, setCountry] = useState<CallingCountry>(() => countryFromE164(initialPhone));
    const schema = useMemo(() => createContactSchema(country), [country]);

    const form = useForm(schema, {
        fullName: joinFullName(initialFirstName, initialLastName),
        phone: initialPhone ?? '',
        // A synthetic phone identifier is not an address the customer typed,
        // so it is never echoed back into the field.
        email: displayCustomerEmail(initialEmail) ?? '',
    });

    const [conflict, setConflict] = useState(false);
    const [failure, setFailure] = useState<PresentedError | null>(null);

    const handleSubmit = () => {
        setConflict(false);
        setFailure(null);

        const parsed = form.submit();
        if (!parsed) return;

        const {firstName, lastName} = splitFullName(parsed.fullName);
        const phoneNumber = parsed.phone?.trim();
        const email = parsed.email?.trim();

        setCustomer.mutate(
            {
                // Guaranteed by the schema: one of the two is present.
                emailAddress: email || guestEmailFromPhone(phoneNumber!),
                firstName,
                lastName,
                ...(phoneNumber ? {phoneNumber} : {}),
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
                label={t('fullName')}
                icon="account"
                value={form.values.fullName}
                onChangeText={value => form.setValue('fullName', value)}
                onBlur={() => form.blur('fullName')}
                error={form.errors.fullName}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
            />

            {/* Above both fields, not under one: it is a rule about the pair,
                and attached to either alone it reads as that field being the
                optional one. */}
            <Text variant="micro" color="textMuted">
                {t('contactHint')}
            </Text>

            <PhoneField
                label={t('phoneNumber')}
                value={form.values.phone}
                country={country}
                onChange={value => form.setValue('phone', value)}
                onCountryChange={setCountry}
                onBlur={() => form.blur('phone')}
                error={form.errors.phone}
                selectorLabel={tAuth('countryCode')}
                searchPlaceholder={tAuth('searchCountry')}
                noMatchMessage={tAuth('noCountriesMatch')}
            />

            <Field
                label={t('emailAddress')}
                icon="mail"
                value={form.values.email}
                onChangeText={value => form.setValue('email', value)}
                onBlur={() => form.blur('email')}
                error={form.errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
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
