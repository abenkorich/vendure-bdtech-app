import {useMemo, useState} from 'react';
import {useRouter} from 'expo-router';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Screen, Text, Button, EmptyState} from '@/components/ui';
import {useRegister} from '@/features/auth/queries';
import {createRegisterSchema} from '@/features/auth/schemas';
import {useForm} from '@/features/auth/use-form';
import {Field} from '@/features/account/components/Field';
import {PhoneField} from '@/features/account/components/PhoneField';
import {BackHeader, ErrorBanner, FormBody} from '@/features/account/components/chrome';
import {CaptchaNotice} from '@/features/auth/CaptchaNotice';
import {GoogleSignInButton} from '@/features/auth/google';
import {useT} from '@/features/account/i18n';
import {useTranslations} from '@/i18n';
import {DEFAULT_COUNTRY, type CallingCountry} from '@/lib/phone-number';
import {guestEmailFromPhone, splitFullName} from '@/lib/contact-details';

/**
 * Register.
 *
 * The form asks, in this order, for a name, a way to reach the customer, and
 * a password. **Either a mobile or an email will do** — this store's customers
 * are reached by phone far more often than by email, and demanding an address
 * from someone who does not use one loses the account. The same rule and the
 * same order are on the website's sign-up form; the two write to one customer
 * table, so they have to agree on what a complete contact is.
 *
 * Vendure has no phone-only customer: `emailAddress` is the identifier. So a
 * customer who gives only a mobile gets the synthetic one the website's
 * backend already understands (`contact-details.ts`), and is told to sign in
 * with their mobile rather than to check an inbox no message will arrive in.
 *
 * One typed name is split into Vendure's two columns rather than asking for
 * both: nobody thinks of their name in two fields, and the split rule is
 * shared with the website so the same person is not stored two ways.
 */
export default function RegisterScreen() {
    const t = useT('Auth');
    const tCommon = useTranslations('Common');
    const router = useRouter();
    const register = useRegister();
    const [verificationSent, setVerificationSent] = useState(false);
    const [byPhoneOnly, setByPhoneOnly] = useState(false);

    // The country decides what a valid mobile is, so the schema follows it.
    const [country, setCountry] = useState<CallingCountry>(DEFAULT_COUNTRY);
    const schema = useMemo(() => createRegisterSchema(country), [country]);

    const form = useForm(schema, {
        fullName: '',
        phone: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const onSubmit = () => {
        const parsed = form.submit();
        if (!parsed) return;

        const {firstName, lastName} = splitFullName(parsed.fullName);
        const phoneNumber = parsed.phone?.trim();
        const email = parsed.email?.trim();
        // Guaranteed by the schema: one of the two is present.
        const emailAddress = email || guestEmailFromPhone(phoneNumber!);

        register.mutate(
            {
                emailAddress,
                firstName,
                lastName,
                password: parsed.password,
                ...(phoneNumber ? {phoneNumber} : {}),
            },
            {
                onSuccess: result => {
                    if (!result.requiresVerification) {
                        router.replace('/account');
                        return;
                    }
                    setByPhoneOnly(!email);
                    setVerificationSent(true);
                },
            },
        );
    };

    if (verificationSent) {
        return (
            <Screen>
                <BackHeader title={t('createAccount')} />
                <EmptyState
                    icon={byPhoneOnly ? 'checkCircle' : 'mail'}
                    title={byPhoneOnly ? t('accountCreated') : t('checkYourEmail')}
                    message={
                        byPhoneOnly ? t('accountCreatedByPhone') : t('checkYourEmailDescription')
                    }
                    action={{label: t('backToSignIn'), onPress: () => router.replace('/auth/sign-in')}}
                />
            </Screen>
        );
    }

    return (
        <Screen>
            <BackHeader title={t('createAccount')} subtitle={t('signUpMessage')} />

            <FormBody>
                <ErrorBanner error={register.error} />

                <Field
                    label={t('fullNameLabel')}
                    icon="account"
                    value={form.values.fullName}
                    onChangeText={value => form.setValue('fullName', value)}
                    onBlur={() => form.blur('fullName')}
                    error={form.errors.fullName}
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                />

                {/* The hint sits above both contact fields rather than under
                    one of them: it is a rule about the pair, and attached to
                    either field alone it reads as that field being optional. */}
                <Text variant="micro" color="textMuted">
                    {t('emailOrPhoneHint')}
                </Text>

                <PhoneField
                    label={t('mobileNumberLabel')}
                    value={form.values.phone}
                    country={country}
                    onChange={value => form.setValue('phone', value)}
                    onCountryChange={setCountry}
                    onBlur={() => form.blur('phone')}
                    error={form.errors.phone}
                    selectorLabel={t('countryCode')}
                    searchPlaceholder={t('searchCountry')}
                    noMatchMessage={t('noCountriesMatch')}
                />

                <Field
                    label={t('emailAddressLabel')}
                    icon="mail"
                    value={form.values.email}
                    onChangeText={value => form.setValue('email', value)}
                    onBlur={() => form.blur('email')}
                    error={form.errors.email}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                />

                <Field
                    label={t('passwordLabel')}
                    icon="lock"
                    secure
                    value={form.values.password}
                    onChangeText={value => form.setValue('password', value)}
                    onBlur={() => form.blur('password')}
                    error={form.errors.password}
                    hint={t('passwordMinLength')}
                    autoComplete="new-password"
                    textContentType="newPassword"
                />

                <Field
                    label={t('confirmPasswordLabel')}
                    icon="lock"
                    secure
                    value={form.values.confirmPassword}
                    onChangeText={value => form.setValue('confirmPassword', value)}
                    onBlur={() => form.blur('confirmPassword')}
                    error={form.errors.confirmPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={onSubmit}
                />

                <Button fullWidth size="lg" loading={register.isPending} onPress={onSubmit}>
                    {register.isPending ? t('creatingAccount') : t('createAccount')}
                </Button>

                <GoogleSignInButton
                    separatorBefore={tCommon('or')}
                    onSignedIn={() => {
                        if (router.canGoBack()) router.back();
                        else router.replace('/account');
                    }}
                />

                <View style={styles.footer}>
                    <Text variant="caption" color="textMuted">
                        {t('alreadyHaveAccount')}
                    </Text>
                    <Button variant="ghost" size="sm" onPress={() => router.replace('/auth/sign-in')}>
                        {t('signInLink')}
                    </Button>
                </View>

                <CaptchaNotice action="register" />
            </FormBody>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
    },
}));
