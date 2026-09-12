import {useEffect, useState} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useMutation} from '@tanstack/react-query';
import {Text, Button, IconSymbol, Sheet} from '@/components/ui';
import {Field} from '@/features/account/components/Field';
import {ErrorBanner} from '@/features/account/components/chrome';
import {useTranslations} from '@/i18n';
import {mutate} from '@/lib/vendure/api';
import {CUSTOMER_ROOT} from '@/lib/query-keys';
import {
    SubscribeToStockAlertMutation,
    type StockAlertSubscription,
} from '@/lib/vendure/stock-alert';
import {useCaptcha} from '@/features/auth/captcha';
import {useSession} from '@/features/auth/queries';
import {displayCustomerEmail, isValidEmail} from '@/lib/contact-details';

/**
 * "Notify me when it's back".
 *
 * An out-of-stock product is the one place a shop can still capture intent,
 * and a greyed-out button captures none of it. This is the same
 * `subscribeToStockAlert` the website calls, so the two front-ends write to
 * one subscription table and a customer who asked on the phone is not mailed
 * again for asking on the web.
 *
 * The address is one editable field, prefilled from the session so a signed-in
 * customer confirms rather than types. A guest fills it in, and so does a
 * *phone-only* account: its `emailAddress` is the synthetic
 * `…@phone.guest.local` identifier, which is not a mailbox, so
 * `displayCustomerEmail` filters it out and that customer is asked for a real
 * address like any guest.
 *
 * **Caveat, and it is the backend's:** `StockAlertService.resolveSubscriptionEmail`
 * is `customer?.emailAddress ?? inputEmail`, so for a signed-in customer the
 * account address wins and an edit made here is discarded — the row is filed
 * under the account address, lowercased. The field is still prefilled and sent
 * as typed; making the edit stick means flipping that precedence on the
 * backend so a supplied address beats the account one.
 */

export interface StockAlertInput {
    variantId: string;
    /** Omitted for a signed-in customer, whom the backend resolves itself. */
    email?: string;
}

export function useStockAlert() {
    const captcha = useCaptcha();

    return useMutation({
        mutationKey: [CUSTOMER_ROOT, 'stock-alert'],
        mutationFn: async ({variantId, email}: StockAlertInput) => {
            const captchaToken = await captcha.execute('stock_alert');
            const {data} = await mutate(
                SubscribeToStockAlertMutation,
                {input: {variantId, ...(email ? {email} : {})}},
                // Signed in, the subscription is attached to the customer
                // rather than to a loose address, so it survives an email
                // change and shows up in their account.
                {useAuthToken: true, captchaToken},
            );
            return (data as {subscribeToStockAlert: StockAlertSubscription | null})
                .subscribeToStockAlert;
        },
    });
}

export interface StockAlertSheetProps {
    open: boolean;
    onClose: () => void;
    /** The variant to watch. The sheet is inert without one. */
    variantId?: string | null;
    productName: string;
}

export function StockAlertSheet({open, onClose, variantId, productName}: StockAlertSheetProps) {
    const t = useTranslations('Product');
    const tAuth = useTranslations('Auth');
    const tCommon = useTranslations('Common');
    const {customer} = useSession();
    const alert = useStockAlert();

    const accountEmail = displayCustomerEmail(customer?.emailAddress) ?? '';
    const [email, setEmail] = useState(accountEmail);
    const [invalid, setInvalid] = useState(false);
    const [done, setDone] = useState(false);

    // The session answers after the sheet can already be open, so the prefill
    // lands when it arrives — but never over something already typed.
    useEffect(() => {
        if (accountEmail) setEmail(current => current || accountEmail);
    }, [accountEmail]);

    // Each opening is a fresh attempt: a previous failure must not greet the
    // next product with a red banner about a different one.
    useEffect(() => {
        if (!open) return;
        setInvalid(false);
        setDone(false);
        alert.reset();
        // `alert.reset` is stable for the life of the mutation observer.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const submit = () => {
        if (!variantId) return;
        const trimmed = email.trim();
        // Signed-in customers may leave it blank; a guest may not, and either
        // way a typed address has to be a real one.
        if (!trimmed || !isValidEmail(trimmed)) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        alert.mutate({variantId, email: trimmed}, {onSuccess: () => setDone(true)});
    };

    return (
        <Sheet open={open} onClose={onClose} title={t('notifyMe')}>
            {done ? (
                <View style={styles.done}>
                    <IconSymbol name="checkCircle" size={32} color="success" />
                    <Text variant="body" align="center">
                        {t('notifySuccess')}
                    </Text>
                    <Text variant="caption" color="textMuted" align="center">
                        {productName}
                    </Text>
                    <Button variant="secondary" fullWidth onPress={onClose}>
                        {tCommon('close')}
                    </Button>
                </View>
            ) : (
                <View style={styles.form}>
                    <Text variant="caption" color="textMuted">
                        {t('notifyMeHint')}
                    </Text>

                    <Field
                        label={tAuth('emailAddressLabel')}
                        icon="mail"
                        placeholder={t('notifyEmailPlaceholder')}
                        value={email}
                        onChangeText={value => {
                            setEmail(value);
                            setInvalid(false);
                        }}
                        error={invalid ? tAuth('emailValidation') : undefined}
                        autoCapitalize="none"
                        autoComplete="email"
                        keyboardType="email-address"
                        textContentType="emailAddress"
                        returnKeyType="go"
                        onSubmitEditing={submit}
                    />

                    {/* The server's own words, via the banner the auth forms
                        use. `notifyError` said "please try again" for every
                        failure, including the ones retrying cannot fix — a
                        rejected captcha, an unreachable API, a variant the
                        channel does not carry all looked identical, which is
                        exactly what made this hard to diagnose on a phone. */}
                    <ErrorBanner error={alert.error} />

                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        icon="bell"
                        loading={alert.isPending}
                        disabled={!variantId}
                        onPress={submit}
                    >
                        {t('notifySubmit')}
                    </Button>
                </View>
            )}
        </Sheet>
    );
}

const styles = StyleSheet.create(theme => ({
    form: {
        gap: theme.spacing.md,
        paddingBottom: theme.spacing.md,
    },
    done: {
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.lg,
    },
}));
