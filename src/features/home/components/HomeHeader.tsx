import {View, Pressable} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Text, IconSymbol} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {siteImageSource} from '@/lib/site-config/bundled-assets';
import {env} from '@/lib/env';

/**
 * Home header: messages on the leading side, the brand centred, notifications
 * on the trailing side.
 *
 * Modelled on the marketplace pattern the merchant asked for: the logo sits
 * between the two icon buttons, and both buttons carry unread badges. The two
 * side slots have the same fixed width so the logo is centred on the screen,
 * not merely between whatever the icons happen to measure.
 *
 * "Leading" and "trailing" rather than left and right on purpose. In Arabic
 * the whole row mirrors, and hardcoding left/right here would put the icons
 * on the wrong sides for a third of this store's customers.
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
            <View style={styles.side}>
                <ActionButton
                    icon="chat"
                    count={unreadMessages}
                    label={t('messages')}
                    onPress={() => router.push('/messages')}
                />
            </View>

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

            <View style={[styles.side, styles.sideEnd]}>
                <ActionButton
                    icon="bell"
                    count={unreadNotifications}
                    label={t('notifications')}
                    onPress={() => router.push('/notifications')}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    /** Equal-width slots either side, so the brand is centred on the screen. */
    side: {
        width: 44,
        alignItems: 'flex-start',
    },
    sideEnd: {
        alignItems: 'flex-end',
    },
    brand: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.sm,
    },
    logo: {
        width: 180,
        maxWidth: '100%',
        height: 44,
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
