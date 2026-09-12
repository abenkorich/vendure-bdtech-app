import {Linking, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Screen, Text, Button, IconSymbol} from '@/components/ui';
import {BackHeader, FormBody} from '@/features/account/components/chrome';
import {useT} from '@/features/account/i18n';
import {useSiteConfig} from '@/lib/site-config';
import {env} from '@/lib/env';

/**
 * Delete account.
 *
 * Google Play requires an in-app path to account deletion for any app that
 * lets people create an account, alongside a public web page for those who
 * have already uninstalled. This is the in-app half; the page at
 * `/account-deletion` on the storefront is the other, and both say the same
 * thing on purpose — a customer who checks one against the other should not
 * find two different policies.
 *
 * It sends a request rather than deleting on the spot. The Shop API has no
 * customer-deletion mutation, and orders carry invoice data the store is
 * required to keep, so a button that claimed to erase everything would be
 * lying. Play accepts a documented request channel; what it does not accept is
 * no channel at all.
 *
 * The mail address comes from the merchant's own store info, so it follows the
 * customizer rather than being pinned in the binary. Without one the screen
 * still works: the web page is always reachable and carries every contact
 * route the merchant has published.
 */
export default function DeleteAccountScreen() {
    const t = useT('Account');
    const router = useRouter();
    const {config} = useSiteConfig();

    const email = config.storeInfo.emails.map(row => row.value.trim()).find(Boolean);
    const webUrl = `${env.siteUrl.replace(/\/$/, '')}/account-deletion`;

    const points = [
        t('deleteAccountDeleted1'),
        t('deleteAccountDeleted2'),
        t('deleteAccountDeleted3'),
    ];

    return (
        <Screen>
            <BackHeader title={t('deleteAccount')} subtitle={t('deleteAccountSubtitle')} />

            <FormBody>
                <Text variant="body" color="textMuted">
                    {t('deleteAccountIntro')}
                </Text>

                <View style={styles.list}>
                    {points.map(point => (
                        <View key={point} style={styles.point}>
                            <IconSymbol name="check" size={15} color="textMuted" />
                            <Text variant="caption" color="textMuted" style={styles.pointText}>
                                {point}
                            </Text>
                        </View>
                    ))}
                </View>

                <View style={styles.notice}>
                    <IconSymbol name="info" size={16} color="textMuted" />
                    <Text variant="caption" color="textMuted" style={styles.pointText}>
                        {t('deleteAccountKept')}
                    </Text>
                </View>

                {email ? (
                    <Button
                        variant="danger"
                        size="lg"
                        fullWidth
                        icon="mail"
                        onPress={() =>
                            void Linking.openURL(
                                `mailto:${email}?subject=${encodeURIComponent(
                                    t('deleteAccountSubject'),
                                )}`,
                            )
                        }
                    >
                        {t('deleteAccountRequest')}
                    </Button>
                ) : null}

                <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    icon="globe"
                    onPress={() => void Linking.openURL(webUrl)}
                >
                    {t('deleteAccountOpenPage')}
                </Button>

                <Button variant="ghost" fullWidth onPress={() => router.back()}>
                    {t('deleteAccountKeep')}
                </Button>
            </FormBody>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    list: {
        gap: theme.spacing.sm,
    },
    point: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
    },
    pointText: {
        flex: 1,
    },
    notice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
    },
}));
