import {useState} from 'react';
import {useRouter} from 'expo-router';
import {Screen, Button, EmptyState} from '@/components/ui';
import {useSession} from '@/features/auth/queries';
import {useUpdateProfile} from '@/features/account/queries';
import {profileSchema} from '@/features/auth/schemas';
import {useForm} from '@/features/auth/use-form';
import {Field} from '@/features/account/components/Field';
import {
    BackHeader,
    ErrorBanner,
    FormBody,
    SuccessBanner,
} from '@/features/account/components/chrome';
import {useT} from '@/features/account/i18n';

/**
 * Profile.
 *
 * Name and phone only. The email address is shown but not editable here:
 * Vendure changes it through a verification email
 * (`requestUpdateCustomerEmailAddress`), which is a flow of its own, and a
 * field that looks editable and then silently is not would be worse than a
 * read-only one that says so.
 *
 * The account tab linked here before this screen existed, which is the dead
 * link `tests/routes.test.ts` now scans the source for.
 */
export default function ProfileScreen() {
    const t = useT('Account');
    const tAuth = useT('Auth');
    const router = useRouter();
    const session = useSession();

    if (session.isLoading) {
        return (
            <Screen>
                <BackHeader title={t('profilePageTitle')} />
            </Screen>
        );
    }

    if (!session.isSignedIn || !session.customer) {
        return (
            <Screen>
                <BackHeader title={t('profilePageTitle')} />
                <EmptyState
                    icon="lock"
                    title={t('profilePageTitle')}
                    message={t('quickProfileDesc')}
                    action={{label: tAuth('signIn'), onPress: () => router.replace('/auth/sign-in')}}
                />
            </Screen>
        );
    }

    return (
        <Screen>
            <BackHeader title={t('profilePageTitle')} subtitle={t('quickProfileDesc')} />
            <ProfileForm
                customer={session.customer}
                onSaved={() => void session.refetch()}
            />
        </Screen>
    );
}

function ProfileForm({
    customer,
    onSaved,
}: {
    customer: {firstName: string; lastName: string; emailAddress: string; phoneNumber?: string | null};
    onSaved: () => void;
}) {
    const t = useT('Account');
    const update = useUpdateProfile();
    const [saved, setSaved] = useState(false);

    const form = useForm(profileSchema, {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phoneNumber: customer.phoneNumber ?? '',
    });

    const onSubmit = () => {
        const parsed = form.submit();
        if (!parsed) return;

        setSaved(false);
        update.mutate(
            {
                firstName: parsed.firstName,
                lastName: parsed.lastName,
                // An emptied phone field clears the number rather than
                // sending "" and having the backend keep the old one.
                phoneNumber: parsed.phoneNumber || null,
            },
            {
                onSuccess: () => {
                    setSaved(true);
                    onSaved();
                },
            },
        );
    };

    return (
        <FormBody>
            <ErrorBanner error={update.error} />
            {saved && !update.error ? <SuccessBanner message={t('profileUpdated')} /> : null}

            <Field
                label={t('firstName')}
                value={form.values.firstName}
                onChangeText={value => {
                    setSaved(false);
                    form.setValue('firstName', value);
                }}
                onBlur={() => form.blur('firstName')}
                error={form.errors.firstName}
                autoComplete="given-name"
                textContentType="givenName"
            />
            <Field
                label={t('lastName')}
                value={form.values.lastName}
                onChangeText={value => {
                    setSaved(false);
                    form.setValue('lastName', value);
                }}
                onBlur={() => form.blur('lastName')}
                error={form.errors.lastName}
                autoComplete="family-name"
                textContentType="familyName"
            />
            <Field
                label={t('phoneNumber')}
                value={form.values.phoneNumber ?? ''}
                onChangeText={value => {
                    setSaved(false);
                    form.setValue('phoneNumber', value);
                }}
                onBlur={() => form.blur('phoneNumber')}
                error={form.errors.phoneNumber}
                tabular
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="done"
                onSubmitEditing={onSubmit}
            />
            <Field
                label={t('emailAddress')}
                value={customer.emailAddress}
                editable={false}
                hint={t('updateEmailDescription')}
                autoComplete="email"
            />

            <Button fullWidth size="lg" loading={update.isPending} onPress={onSubmit}>
                {t('updateProfile')}
            </Button>
        </FormBody>
    );
}
