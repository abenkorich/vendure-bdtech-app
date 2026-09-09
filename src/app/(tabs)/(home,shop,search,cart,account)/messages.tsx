import {Linking, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Screen, Text, Button, Card, IconSymbol} from '@/components/ui';
import {useTranslations, useLocale} from '@/i18n';
import {useSiteConfig} from '@/lib/site-config';
import {contactLabel} from '@/lib/site-config/schema';

/**
 * Support contact.
 *
 * Not a message thread. There is no conversation store on this backend, and
 * the AI shop chat is disabled on this channel (verified against the live
 * Shop API: `aiShopChatSettings.enabled` is false), so a chat UI would be a
 * screen that cannot send anything.
 *
 * What a customer wants behind this icon is to reach a human about an order,
 * so it offers the ways that actually work today. When a thread store or the
 * AI chat lands, this becomes the conversation list and these move to a header
 * action.
 */

export default function MessagesScreen() {
    const tNav = useTranslations('Navigation');
    const tCommon = useTranslations('Common');
    const tAccount = useTranslations('Account');
    const {locale} = useLocale();
    const {config} = useSiteConfig();

    // Real contact rows from the merchant's own store info, not constants
    // invented here: a wrong support number is worse than none at all.
    const {emails, phones} = config.storeInfo;

    return (
        <Screen>
            <View style={styles.header}>
                <Button variant="ghost" size="sm" icon="chevronBack" onPress={() => router.back()}>
                    {tCommon('back')}
                </Button>
            </View>

            <View style={styles.body}>
                <Text variant="title">{tNav('messages')}</Text>
                <Text variant="body" color="textMuted">
                    {tAccount('messagesIntro')}
                </Text>

                <Card style={styles.card}>
                    {phones.map(row => (
                        <Button
                            key={row.id ?? row.value}
                            variant="secondary"
                            icon="phone"
                            fullWidth
                            onPress={() =>
                                void Linking.openURL(`tel:${row.value.replace(/\s+/g, '')}`)
                            }
                        >
                            {`${contactLabel(row, locale)} · ${row.value}`}
                        </Button>
                    ))}

                    {emails.map(row => (
                        <Button
                            key={row.id ?? row.value}
                            variant="secondary"
                            icon="mail"
                            fullWidth
                            onPress={() => void Linking.openURL(`mailto:${row.value}`)}
                        >
                            {`${contactLabel(row, locale)} · ${row.value}`}
                        </Button>
                    ))}
                </Card>

                <View style={styles.hint}>
                    <IconSymbol name="receipt" size={16} color="textMuted" />
                    <Text variant="caption" color="textMuted" style={styles.flex}>
                        {tAccount('messagesOrderHint')}
                    </Text>
                </View>
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
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
    },
    card: {
        gap: theme.spacing.sm,
    },
    hint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    flex: {flex: 1},
}));
