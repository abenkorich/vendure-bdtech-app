import {useRouter} from 'expo-router';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Screen, Text, Button, IconSymbol} from '@/components/ui';
import {useSignIn} from '@/features/auth/queries';
import {signInSchema} from '@/features/auth/schemas';
import {useForm} from '@/features/auth/use-form';
import {Field} from '@/features/account/components/Field';
import {BackHeader, ErrorBanner, FormBody} from '@/features/account/components/chrome';
import {CaptchaNotice} from '@/features/auth/CaptchaNotice';
import {GoogleSignInButton} from '@/features/auth/google';
import {useT} from '@/features/account/i18n';
import {useTranslations} from '@/i18n';

/**
 * Sign in.
 *
 * **Google comes first.** It is one tap against five fields plus a password
 * nobody remembers, so it is the top of the screen and the credentials form
 * is the alternative below the rule — not the other way round.
 *
 * The identifier field takes an email *or* a mobile, because registration
 * accepts either: an account created with a mobile and no address has no
 * email to type here. `useSignIn` maps whichever was typed onto the
 * identifier the account actually carries.
 *
 * The failure path is the other piece of design work. `useSignIn` throws
 * either a `VendureResultError` carrying the server's own message ("The
 * provided credentials are invalid") or a `ServerUnreachableError`;
 * `ErrorBanner` renders those differently, so "wrong password" and "no
 * connection" are never the same screen. A single "Something went wrong"
 * would leave a user retyping a correct password on a dead connection.
 */
export default function SignInScreen() {
    const t = useT('Auth');
    const tCommon = useTranslations('Common');
    const router = useRouter();
    const signIn = useSignIn();
    const form = useForm(signInSchema, {identifier: '', password: ''});

    const onSubmit = () => {
        const parsed = form.submit();
        if (!parsed) return;
        signIn.mutate(
            {username: parsed.identifier, password: parsed.password},
            {
                onSuccess: () => {
                    // `useSignIn` awaits the customer refetch before resolving,
                    // so the account screen never flickers "signed out".
                    if (router.canGoBack()) router.back();
                    else router.replace('/account');
                },
            },
        );
    };

    return (
        <Screen>
            <BackHeader title={t('signIn')} subtitle={t('enterCredentials')} />

            <FormBody>
                <GoogleSignInButton
                    separatorAfter={tCommon('or')}
                    onSignedIn={() => {
                        if (router.canGoBack()) router.back();
                        else router.replace('/account');
                    }}
                />

                <ErrorBanner error={signIn.error} />

                <Field
                    label={t('emailOrMobileLabel')}
                    icon="mail"
                    value={form.values.identifier}
                    onChangeText={value => form.setValue('identifier', value)}
                    onBlur={() => form.blur('identifier')}
                    error={form.errors.identifier}
                    autoCapitalize="none"
                    autoComplete="username"
                    keyboardType="email-address"
                    textContentType="username"
                    returnKeyType="next"
                />

                <Field
                    label={t('password')}
                    icon="lock"
                    secure
                    value={form.values.password}
                    onChangeText={value => form.setValue('password', value)}
                    onBlur={() => form.blur('password')}
                    error={form.errors.password}
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={onSubmit}
                />

                <Button variant="ghost" size="sm" onPress={() => router.push('/auth/forgot-password')}>
                    {t('forgotPassword')}
                </Button>

                <Button
                    fullWidth
                    size="lg"
                    loading={signIn.isPending}
                    onPress={onSubmit}
                >
                    {signIn.isPending ? t('signingIn') : t('signIn')}
                </Button>

                <View style={styles.footer}>
                    <Text variant="caption" color="textMuted">
                        {t('noAccount')}
                    </Text>
                    <Button variant="ghost" size="sm" onPress={() => router.replace('/auth/register')}>
                        {t('register')}
                    </Button>
                </View>

                <View style={styles.features}>
                    <Feature icon="truck" label={`${t('featureFast')} ${t('featureCheckout')}`} />
                    <Feature icon="lock" label={`${t('featureSecure')} ${t('featurePayments')}`} />
                    <Feature icon="package" label={`${t('featureEasy')} ${t('featureReturns')}`} />
                </View>

                <CaptchaNotice action="login" />
            </FormBody>
        </Screen>
    );
}

function Feature({icon, label}: {icon: 'truck' | 'lock' | 'package'; label: string}) {
    return (
        <View style={styles.feature}>
            <IconSymbol name={icon} size={18} color="brand" />
            <Text variant="micro" color="textMuted" align="center">
                {label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
    },
    features: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.md,
    },
    feature: {
        flex: 1,
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
    },
}));
