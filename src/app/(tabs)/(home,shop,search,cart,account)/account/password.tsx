import {useRouter} from 'expo-router';
import {Screen, Button, EmptyState} from '@/components/ui';
import {useSession} from '@/features/auth/queries';
import {useUpdatePassword} from '@/features/account/queries';
import {changePasswordSchema} from '@/features/auth/schemas';
import {useForm} from '@/features/auth/use-form';
import {Field} from '@/features/account/components/Field';
import {BackHeader, ErrorBanner, FormBody} from '@/features/account/components/chrome';
import {useT} from '@/features/account/i18n';

/**
 * Change password.
 *
 * The current password is required by the backend, so the form asks for it
 * rather than discovering that at submit time. Success replaces the form with
 * a confirmation instead of clearing the fields: a blank form after a submit
 * looks like the submit was lost.
 */
export default function ChangePasswordScreen() {
    const t = useT('Account');
    const tAuth = useT('Auth');
    const router = useRouter();
    const session = useSession();
    const update = useUpdatePassword();

    const form = useForm(changePasswordSchema, {
        currentPassword: '',
        password: '',
        confirmPassword: '',
    });

    if (!session.isLoading && !session.isSignedIn) {
        return (
            <Screen>
                <BackHeader title={t('changePassword')} />
                <EmptyState
                    icon="lock"
                    title={t('changePassword')}
                    message={t('changePasswordDescription')}
                    action={{label: tAuth('signIn'), onPress: () => router.replace('/auth/sign-in')}}
                />
            </Screen>
        );
    }

    if (update.isSuccess) {
        return (
            <Screen>
                <BackHeader title={t('changePassword')} />
                <EmptyState
                    icon="checkCircle"
                    title={t('passwordUpdated')}
                    message={t('changePasswordDescription')}
                    action={{label: t('profile'), onPress: () => router.back()}}
                />
            </Screen>
        );
    }

    const onSubmit = () => {
        const parsed = form.submit();
        if (!parsed) return;
        update.mutate({currentPassword: parsed.currentPassword, newPassword: parsed.password});
    };

    return (
        <Screen>
            <BackHeader title={t('changePassword')} subtitle={t('changePasswordDescription')} />

            <FormBody>
                <ErrorBanner error={update.error} />

                <Field
                    label={t('currentPassword')}
                    icon="lock"
                    secure
                    value={form.values.currentPassword}
                    onChangeText={value => form.setValue('currentPassword', value)}
                    onBlur={() => form.blur('currentPassword')}
                    error={form.errors.currentPassword}
                    autoComplete="current-password"
                    textContentType="password"
                />
                <Field
                    label={t('newPassword')}
                    icon="lock"
                    secure
                    value={form.values.password}
                    onChangeText={value => form.setValue('password', value)}
                    onBlur={() => form.blur('password')}
                    error={form.errors.password}
                    hint={tAuth('passwordMinLength')}
                    autoComplete="new-password"
                    textContentType="newPassword"
                />
                <Field
                    label={t('confirmNewPassword')}
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

                <Button fullWidth size="lg" loading={update.isPending} onPress={onSubmit}>
                    {t('updatePassword')}
                </Button>
            </FormBody>
        </Screen>
    );
}
