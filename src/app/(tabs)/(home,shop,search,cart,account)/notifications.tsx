import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Screen, Text, Button, EmptyState, IconSymbol} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {NotificationOptIn} from '@/features/account/components/NotificationOptIn';
import {useSession} from '@/features/auth/queries';

/**
 * Notification inbox.
 *
 * There is no message store on the backend yet: Vendure has no notification
 * feed, and the app's push work delivers order updates straight to the system
 * tray. So this is honest about being empty rather than inventing a fake feed,
 * and it does the one useful thing available — offering the opt-in, which is
 * what actually makes order updates arrive.
 *
 * When a feed exists, the empty state is replaced by a list and the opt-in
 * moves to the bottom.
 */
export default function NotificationsScreen() {
    const t = useTranslations('Account');
    const tNav = useTranslations('Navigation');
    const tCommon = useTranslations('Common');
    const session = useSession();

    return (
        <Screen>
            <View style={styles.header}>
                <Button
                    variant="ghost"
                    size="sm"
                    icon="chevronBack"
                    onPress={() => router.back()}
                >
                    {tCommon('back')}
                </Button>
            </View>

            <View style={styles.body}>
                <EmptyState
                    icon="bell"
                    title={tNav('notifications')}
                    message={t('notificationsEmptyBody')}
                />

                {session.isSignedIn ? (
                    <View style={styles.optIn}>
                        <NotificationOptIn />
                    </View>
                ) : (
                    <View style={styles.signedOut}>
                        <IconSymbol name="account" size={18} color="textMuted" />
                        <Text variant="caption" color="textMuted" style={styles.flex}>
                            {t('notificationsSignInHint')}
                        </Text>
                    </View>
                )}
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    header: {
        paddingHorizontal: theme.spacing.sm,
        paddingBottom: theme.spacing.sm,
    },
    body: {
        flex: 1,
        justifyContent: 'center',
        gap: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg,
    },
    optIn: {
        paddingHorizontal: theme.spacing.sm,
    },
    signedOut: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
    },
    flex: {flex: 1},
}));
