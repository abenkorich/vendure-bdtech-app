import {View, Pressable} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Text, IconSymbol} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {siteImageSource} from '@/lib/site-config/bundled-assets';
import {env} from '@/lib/env';

/**
 * Home header: brand on the leading side, actions on the trailing side.
 *
 * Modelled on the marketplace pattern the merchant asked for (AliExpress and
 * friends): the logo anchors the leading edge, and notifications and messages
 * sit opposite as icon buttons with unread badges.
 *
 * "Leading" and "trailing" rather than left and right on purpose. In Arabic
 * the whole row mirrors, and hardcoding left/right here would put the logo on
 * the wrong side for a third of this store's customers.
 */

export interface HomeHeaderProps {
    /** Merchant logo from the customizer; falls back to the wordmark. */
    logoUrl?: string;
    siteName?: string;
    unreadNotifications?: number;
    unreadMessages?: number;
}

/** Two digits max: a three-digit badge is wider than the icon it sits on. */
function badgeLabel(count: number): string {
    return count > 99 ? '99+' : String(count);
}

function ActionButton({
    icon,
    count,
    label,
    onPress,
}: {
    icon: 'bell' | 'chat';
    count: number;
    label: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={count > 0 ? `${label} (${count})` : label}
            onPress={onPress}
            style={styles.action}
            hitSlop={8}
        >
            <IconSymbol name={icon} size={24} color="text" />

            {count > 0 ? (
                <View style={styles.badge}>
                    <Text variant="micro" style={styles.badgeText} tabular>
                        {badgeLabel(count)}
                    </Text>
                </View>
            ) : null}
        </Pressable>
    );
}

export function HomeHeader({
    logoUrl,
    siteName,
    unreadNotifications = 0,
    unreadMessages = 0,
}: HomeHeaderProps) {
    const t = useTranslations('Navigation');

    // Customizer paths are relative to the web root and resolve to nothing
    // here; without this the logo silently renders as a blank box. The
    // snapshot's own logo ships with the app, so it needs no network at all.
    const resolvedLogo = siteImageSource(logoUrl, env.siteUrl);

    return (
        <View style={styles.root}>
            <View style={styles.brand}>
                {resolvedLogo ? (
                    <Image
                        source={resolvedLogo}
                        style={styles.logo}
                        contentFit="contain"
                        transition={120}
                        accessibilityLabel={siteName ?? 'Dzduino'}
                    />
                ) : (
                    // The wordmark is the fallback, not the default: a merchant
                    // who uploads a logo should see it here too.
                    <Text variant="heading" color="brand" numberOfLines={1}>
                        {siteName || 'Dzduino'}
                    </Text>
                )}
            </View>

            <View style={styles.actions}>
                <ActionButton
                    icon="bell"
                    count={unreadNotifications}
                    label={t('notifications')}
                    onPress={() => router.push('/notifications')}
                />
                <ActionButton
                    icon="chat"
                    count={unreadMessages}
                    label={t('messages')}
                    onPress={() => router.push('/messages')}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.md,
    },
    brand: {
        flex: 1,
        justifyContent: 'center',
    },
    logo: {
        width: 132,
        height: 32,
        // Logos are authored for a light web header, so they are aligned to
        // the leading edge and left to size themselves within that box.
        alignSelf: 'flex-start',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    action: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        top: 4,
        // `end` rather than `right`: the badge follows the icon when the row
        // mirrors in Arabic.
        end: 2,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.sale,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 10,
        lineHeight: 14,
    },
}));
