import {useState} from 'react';
import {useRouter} from 'expo-router';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Screen, Text, Button, EmptyState} from '@/components/ui';
import {useRegister} from '@/features/auth/queries';
import {registerSchema} from '@/features/auth/schemas';
import {useForm} from '@/features/auth/use-form';
import {Field} from '@/features/account/components/Field';
import {BackHeader, ErrorBanner, FormBody} from '@/features/account/components/chrome';
import {useT} from '@/features/account/i18n';

/**
 * Register.
 *
 * This channel emails a verification link, so a successful registration does
 * **not** produce a session (`useRegister` returns `requiresVerification`).
 * Navigating to the account hub on success would show a signed-out screen and
 * read as a failed sign-up, so the success path renders a "check your email"
 * state instead.
 */
export default function RegisterScreen() {
    const t = useT('Auth');
    const router = useRouter();
    const register = useRegister();
    const [verificationSent, setVerificationSent] = useState(false);

    const form = useForm(registerSchema, {
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        password: '',
        confirmPassword: '',
    });

    const onSubmit = () => {
        const parsed = form.submit();
        if (!parsed) return;
        register.mutate(
            {
                emailAddress: parsed.email,
                firstName: parsed.firstName,
                lastName: parsed.lastName,
                password: parsed.password,
                ...(parsed.phoneNumber ? {phoneNumber: parsed.phoneNumber} : {}),
            },
            {
                onSuccess: result => {
                    if (result.requiresVerification) setVerificationSent(true);
                    else router.replace('/(tabs)/account');
                },
            },
        );
    };

    if (verificationSent) {
        return (
            <Screen>
                <BackHeader title={t('createAccount')} />
                <EmptyState
                    icon="mail"
                    title={t('checkYourEmail')}
                    message={t('checkYourEmailDescription')}
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

                <View style={styles.row}>
                    <Field
                        containerStyle={styles.rowItem}
                        label={t('firstNameLabel')}
                        value={form.values.firstName}
                        onChangeText={value => form.setValue('firstName', value)}
                        onBlur={() => form.blur('firstName')}
                        error={form.errors.firstName}
                        autoComplete="given-name"
                        textContentType="givenName"
                    />
                    <Field
                        containerStyle={styles.rowItem}
                        label={t('lastNameLabel')}
                        value={form.values.lastName}
                        onChangeText={value => form.setValue('lastName', value)}
                        onBlur={() => form.blur('lastName')}
                        error={form.errors.lastName}
                        autoComplete="family-name"
                        textContentType="familyName"
                    />
                </View>

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
                    label={t('phoneNumberLabel')}
                    icon="phone"
                    tabular
                    value={form.values.phoneNumber}
                    onChangeText={value => form.setValue('phoneNumber', value)}
                    onBlur={() => form.blur('phoneNumber')}
                    error={form.errors.phoneNumber}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
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

                <View style={styles.footer}>
                    <Text variant="caption" color="textMuted">
                        {t('alreadyHaveAccount')}
                    </Text>
                    <Button variant="ghost" size="sm" onPress={() => router.replace('/auth/sign-in')}>
                        {t('signInLink')}
                    </Button>
                </View>
            </FormBody>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
    rowItem: {flex: 1},
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
    },
}));
