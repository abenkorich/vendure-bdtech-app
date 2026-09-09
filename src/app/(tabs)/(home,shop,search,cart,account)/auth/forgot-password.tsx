import {useRouter} from 'expo-router';
import {Screen, Button, EmptyState} from '@/components/ui';
import {useRequestPasswordReset} from '@/features/auth/queries';
import {forgotPasswordSchema} from '@/features/auth/schemas';
import {useForm} from '@/features/auth/use-form';
import {Field} from '@/features/account/components/Field';
import {BackHeader, ErrorBanner, FormBody} from '@/features/account/components/chrome';
import {CaptchaNotice} from '@/features/auth/CaptchaNotice';
import {useT} from '@/features/account/i18n';

/**
 * Forgot password.
 *
 * The confirmation is deliberately vague ("if an account exists…"): saying
 * "no such account" would turn this form into an account-enumeration oracle
 * against a real customer database.
 */
export default function ForgotPasswordScreen() {
    const t = useT('Auth');
    const router = useRouter();
    const request = useRequestPasswordReset();
    const form = useForm(forgotPasswordSchema, {email: ''});

    const onSubmit = () => {
        const parsed = form.submit();
        if (!parsed) return;
        request.mutate(parsed.email);
    };

    if (request.isSuccess) {
        return (
            <Screen>
                <BackHeader title={t('forgotPasswordPageTitle')} />
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
            <BackHeader
                title={t('forgotPasswordTitle')}
                subtitle={t('forgotPasswordDescription')}
            />

            <FormBody>
                <ErrorBanner error={request.error} />

                <Field
                    label={t('email')}
                    icon="mail"
                    value={form.values.email}
                    onChangeText={value => form.setValue('email', value)}
                    onBlur={() => form.blur('email')}
                    error={form.errors.email}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="go"
                    onSubmitEditing={onSubmit}
                />

                <Button fullWidth size="lg" loading={request.isPending} onPress={onSubmit}>
                    {request.isPending ? t('sending') : t('sendResetLink')}
                </Button>

                <Button variant="ghost" fullWidth onPress={() => router.replace('/auth/sign-in')}>
                    {t('backToSignIn')}
                </Button>
                <CaptchaNotice action="password_reset" />
            </FormBody>
        </Screen>
    );
}
