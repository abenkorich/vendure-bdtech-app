import {useLocalSearchParams, useRouter} from 'expo-router';
import {Screen, Button, EmptyState} from '@/components/ui';
import {useResetPassword} from '@/features/auth/queries';
import {resetPasswordSchema} from '@/features/auth/schemas';
import {useForm} from '@/features/auth/use-form';
import {Field} from '@/features/account/components/Field';
import {BackHeader, ErrorBanner, FormBody} from '@/features/account/components/chrome';
import {useT} from '@/features/account/i18n';

/**
 * Reset password.
 *
 * Reached from the emailed link via deep link (`dz.dzduino.app://auth/reset-password?token=…`),
 * so the token comes from the route, never from user input. A missing token
 * renders the invalid-link state rather than a form that could only ever fail
 * on submit.
 */
export default function ResetPasswordScreen() {
    const t = useT('Auth');
    const router = useRouter();
    const {token} = useLocalSearchParams<{token?: string}>();
    const reset = useResetPassword();
    const form = useForm(resetPasswordSchema, {password: '', confirmPassword: ''});

    if (!token) {
        return (
            <Screen>
                <BackHeader title={t('resetYourPassword')} />
                <EmptyState
                    tone="error"
                    title={t('invalidResetLink')}
                    message={t('invalidResetLinkDescription')}
                    action={{
                        label: t('requestNewResetLink'),
                        onPress: () => router.replace('/auth/forgot-password'),
                    }}
                />
            </Screen>
        );
    }

    if (reset.isSuccess) {
        return (
            <Screen>
                <BackHeader title={t('resetYourPassword')} />
                <EmptyState
                    icon="checkCircle"
                    title={t('resetPassword')}
                    message={t('checkYourEmailDescription')}
                    action={{
                        label: t('signIn'),
                        onPress: () => router.replace('/(tabs)/account'),
                    }}
                />
            </Screen>
        );
    }

    const onSubmit = () => {
        const parsed = form.submit();
        if (!parsed) return;
        reset.mutate({token, password: parsed.password});
    };

    return (
        <Screen>
            <BackHeader
                title={t('resetYourPassword')}
                subtitle={t('resetYourPasswordDescription')}
            />

            <FormBody>
                <ErrorBanner error={reset.error} />

                <Field
                    label={t('newPassword')}
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
                    label={t('confirmPassword')}
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

                <Button fullWidth size="lg" loading={reset.isPending} onPress={onSubmit}>
                    {reset.isPending ? t('resettingPassword') : t('resetPassword')}
                </Button>
            </FormBody>
        </Screen>
    );
}
