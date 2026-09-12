import {useEffect} from 'react';
import {ActivityIndicator, Platform, Pressable, View} from 'react-native';
import {GoogleSignin, statusCodes} from '@react-native-google-signin/google-signin';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {StyleSheet} from 'react-native-unistyles';
import {Divider, Text} from '@/components/ui';
import {GoogleMark} from './GoogleMark';
import {mutate, query} from '@/lib/vendure/api';
import {queryKeys, CUSTOMER_ROOT} from '@/lib/query-keys';
import {
    AuthenticateGoogleMutation,
    GetActiveSocialLoginProvidersQuery,
    type SocialLoginProvider,
} from '@/lib/vendure/social-auth';
import {unwrapResult} from '@/lib/types';
import {ErrorBanner} from '@/features/account/components/chrome';
import {env} from '@/lib/env';
import {useTranslations} from '@/i18n';
import {tr} from '@/features/catalogue-strings';

/**
 * Sign in with Google.
 *
 * The backend verifies the Google ID token with `audience` set to the *web*
 * client id it was configured with, so the token has to be minted for that
 * audience. That is why this uses the native library with `webClientId`
 * rather than a plain OAuth redirect: a token minted for the iOS or Android
 * client would carry the wrong audience and be refused.
 *
 * The web client id is not held here either — it comes from the backend,
 * through `activeSocialLoginProviders`, the same list the website reads. Only
 * the iOS client id lives in this app, and only because Google's iOS redirect
 * is a URL scheme that has to be registered in the build (see app.config.ts).
 *
 * The whole button disappears when the merchant has not enabled Google, so a
 * shop without it shows nothing rather than a control that always fails.
 */

/** Cancellation is a normal outcome, not an error worth showing. */
function isCancellation(error: unknown): boolean {
    const code = (error as {code?: unknown} | null)?.code;
    return code === statusCodes.SIGN_IN_CANCELLED;
}

export function useSocialLoginProviders() {
    return useQuery({
        queryKey: queryKeys.socialLoginProviders(),
        queryFn: async ({signal}) => {
            const {data} = await query(GetActiveSocialLoginProvidersQuery, {}, {signal});
            const providers = (data as {activeSocialLoginProviders?: SocialLoginProvider[]})
                .activeSocialLoginProviders;
            return providers ?? [];
        },
        // Which providers a channel offers changes when a merchant edits it,
        // which is rare; a stale list only delays a new button by a session.
        staleTime: 30 * 60 * 1000,
    });
}

export function useGoogleSignIn() {
    const client = useQueryClient();
    const {data: providers} = useSocialLoginProviders();
    const webClientId = providers?.find(provider => provider.code === 'google')?.clientId;

    useEffect(() => {
        if (!webClientId) return;
        GoogleSignin.configure({
            // The audience the backend checks.
            webClientId,
            iosClientId: env.googleIosClientId,
            // No server-side auth code is needed: the backend verifies the ID
            // token directly and never calls Google on the customer's behalf.
            offlineAccess: false,
        });
    }, [webClientId]);

    const mutation = useMutation({
        mutationKey: [CUSTOMER_ROOT, 'google-sign-in'],
        mutationFn: async (): Promise<{cancelled: boolean}> => {
            if (Platform.OS === 'android') {
                await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
            }

            let response;
            try {
                response = await GoogleSignin.signIn();
            } catch (error) {
                if (isCancellation(error)) return {cancelled: true};
                throw error;
            }

            if (response.type !== 'success') return {cancelled: true};

            const idToken = response.data.idToken;
            if (!idToken) throw new Error(tr('Auth.googleAuthFailed'));

            const {data} = await mutate(AuthenticateGoogleMutation, {token: idToken});
            unwrapResult((data as {authenticate: Parameters<typeof unwrapResult>[0]}).authenticate);
            return {cancelled: false};
        },
        onSuccess: async result => {
            if (result.cancelled) return;
            await client.refetchQueries({queryKey: queryKeys.activeCustomer()});
            // The guest cart is merged server-side on login, same as email.
            await client.invalidateQueries({queryKey: queryKeys.activeOrder()});
        },
    });

    return {available: Boolean(webClientId), ...mutation};
}

export interface GoogleSignInButtonProps {
    /** Called after a real sign-in, so the screen can leave. Not on cancel. */
    onSignedIn?: () => void;
    /** "or" rule above the button — for screens where the form comes first. */
    separatorBefore?: string;
    /** "or" rule below it — for screens where Google leads. */
    separatorAfter?: string;
}

/**
 * The button, with Google's own mark and wordmark colours.
 *
 * It is a `Pressable` rather than the design system's `Button` because the
 * design system takes an icon *name* from the app's monochrome set, and
 * Google's guidelines require their four-colour "G" on a white plate. So this
 * one control opts out of the theme deliberately: white in dark mode too,
 * because a recoloured Google button is an off-brand Google button, and
 * shoppers recognise it by exactly those colours.
 *
 * The "or" rule is a prop rather than a fixture because each screen decides
 * whether Google comes before or after the credentials form — and because it
 * has to disappear with the button. A merchant who has not enabled Google
 * would otherwise get a rule with nothing on one side of it.
 */
export function GoogleSignInButton({
    onSignedIn,
    separatorBefore,
    separatorAfter,
}: GoogleSignInButtonProps) {
    const t = useTranslations('Auth');
    const google = useGoogleSignIn();

    if (!google.available) return null;

    return (
        <View style={styles.root}>
            {separatorBefore ? <OrSeparator label={separatorBefore} /> : null}

            <ErrorBanner error={google.error} />

            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('continueWithGoogle')}
                accessibilityState={{busy: google.isPending, disabled: google.isPending}}
                disabled={google.isPending}
                onPress={() =>
                    google.mutate(undefined, {
                        onSuccess: result => {
                            if (!result.cancelled) onSignedIn?.();
                        },
                    })
                }
                style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}
            >
                {google.isPending ? (
                    <ActivityIndicator size="small" color="#3c4043" />
                ) : (
                    <GoogleMark size={20} />
                )}
                <Text variant="bodyStrong" style={styles.label}>
                    {t('continueWithGoogle')}
                </Text>
            </Pressable>

            {separatorAfter ? <OrSeparator label={separatorAfter} /> : null}
        </View>
    );
}

/** A rule with a word in the middle: "Google above, email below". */
export function OrSeparator({label}: {label: string}) {
    return (
        <View style={styles.separator}>
            <View style={styles.rule}>
                <Divider />
            </View>
            <Text variant="micro" color="textMuted" uppercase>
                {label}
            </Text>
            <View style={styles.rule}>
                <Divider />
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        gap: theme.spacing.md,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        minHeight: 52,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.md,
        // Google's own palette, not the theme's: #fff plate, #dadce0 rule,
        // #3c4043 label. Fixed in both schemes on purpose — see above.
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#dadce0',
    },
    buttonPressed: {
        backgroundColor: '#f1f3f4',
    },
    label: {
        color: '#3c4043',
    },
    separator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
    },
    rule: {
        flex: 1,
    },
}));
