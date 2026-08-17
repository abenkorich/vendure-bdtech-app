import {useCallback, useState} from 'react';
import {Alert, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Button, IconSymbol} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {registerForPush, getStoredPushToken, hasDeclinedPush} from '@/lib/push';

/**
 * Order-notification opt-in.
 *
 * This exists because `registerForPush` had no caller: the permission prompt
 * was written but unreachable, so the app could never obtain a token and push
 * could never work no matter what the backend sent.
 *
 * It lives in the account screen rather than firing on launch. iOS grants one
 * permission prompt per install, and spending it before the user has bought
 * anything is how a store ends up permanently unable to say "your order
 * shipped". Asking here means asking someone who has already chosen to look at
 * their account.
 */
export function NotificationOptIn() {
    const t = useTranslations('Account');
    const [enabled, setEnabled] = useState(() => getStoredPushToken() !== null);
    const [declined, setDeclined] = useState(() => hasDeclinedPush());
    const [busy, setBusy] = useState(false);

    const onEnable = useCallback(async () => {
        setBusy(true);
        try {
            const token = await registerForPush();
            if (token) {
                setEnabled(true);
                return;
            }

            // Null covers three cases: declined, a simulator, or no EAS project
            // id. Only the first is worth explaining, and the system settings
            // are the only way back from it.
            setDeclined(hasDeclinedPush());
            Alert.alert(t('notificationsUnavailableTitle'), t('notificationsUnavailableBody'));
        } finally {
            setBusy(false);
        }
    }, [t]);

    if (enabled) {
        return (
            <View style={styles.row}>
                <IconSymbol name="check" size={18} color="success" />
                <Text variant="caption" color="textMuted" style={styles.flex}>
                    {t('notificationsEnabled')}
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <Text variant="bodyStrong">{t('notificationsTitle')}</Text>
            <Text variant="caption" color="textMuted">
                {declined ? t('notificationsDeniedBody') : t('notificationsBody')}
            </Text>

            {!declined ? (
                <Button
                    variant="secondary"
                    size="sm"
                    icon="bell"
                    loading={busy}
                    onPress={() => void onEnable()}
                >
                    {t('notificationsEnable')}
                </Button>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    card: {
        padding: theme.spacing.lg,
        gap: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        alignItems: 'flex-start',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
    },
    flex: {flex: 1},
}));
