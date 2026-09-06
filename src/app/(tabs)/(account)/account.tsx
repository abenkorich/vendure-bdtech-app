import {useCallback, useState} from 'react';
import {Alert, ScrollView, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Screen, Text, Button, Card, Skeleton, IconSymbol} from '@/components/ui';
import {useSession, useSignOut} from '@/features/auth/queries';
import {useOrders, useAddresses} from '@/features/account/queries';
import {LinkRow, RowGroup, ScreenHeader} from '@/features/account/components/chrome';
import {useT, translate} from '@/features/account/i18n';
import {LanguageSheet} from '@/features/account/components/LanguageSheet';
import {NotificationOptIn} from '@/features/account/components/NotificationOptIn';
import {useLocale} from '@/i18n';
import {localeNames} from '@/i18n/routing';

/**
 * Account hub.
 *
 * The signed-out state is the load-bearing half: an account tab that says
 * "please sign in" and stops is a dead end in the one place a shopper lands
 * when they want their order. So it sells the reason to have an account, and
 * still exposes everything that works without one (wishlist, compare, tools,
 * blog) rather than hiding the whole screen behind auth.
 */
export default function AccountScreen() {
    const t = useT('Account');
    const tNav = useT('Navigation');
    const router = useRouter();
    const session = useSession();

    if (session.isLoading) return <AccountSkeleton />;
    if (!session.isSignedIn) return <SignedOut />;

    const name = [session.customer?.firstName, session.customer?.lastName]
        .filter(Boolean)
        .join(' ');

    return (
        <Screen>
            <ScrollView contentContainerStyle={styles.content}>
                <ScreenHeader
                    title={t('welcomeBack', {name: name || tNav('account')})}
                    subtitle={session.customer?.emailAddress ?? undefined}
                />

                <Stats />

                <Section title={t('quickActions')}>
                    <RowGroup>
                        <LinkRow
                            icon="receipt"
                            title={t('quickOrders')}
                            subtitle={t('quickOrdersDesc')}
                            onPress={() => router.push('/account/orders')}
                        />
                        <LinkRow
                            icon="location"
                            title={t('quickAddresses')}
                            subtitle={t('quickAddressesDesc')}
                            onPress={() => router.push('/account/addresses')}
                        />
                        <LinkRow
                            icon="account"
                            title={t('quickProfile')}
                            subtitle={t('quickProfileDesc')}
                            onPress={() => router.push('/account/profile')}
                        />
                        <LinkRow
                            icon="lock"
                            title={t('changePassword')}
                            subtitle={t('changePasswordDescription')}
                            onPress={() => router.push('/account/password')}
                        />
                    </RowGroup>
                </Section>

                <RecentOrders />

                {/* Signed-in only: this is the one caller of registerForPush,
                    and offering order updates to someone with no orders (and
                    spending iOS's single permission prompt on them) is the
                    wrong moment to ask. */}
                <View style={styles.optIn}>
                    <NotificationOptIn />
                </View>

                <Section title={tNav('links')}>
                    <BrowseLinks />
                </Section>

                <SignOutRow />
            </ScrollView>
        </Screen>
    );
}

/* ------------------------------------------------------------- signed out */

function SignedOut() {
    const t = useT('Auth');
    const tNav = useT('Navigation');
    const router = useRouter();

    return (
        <Screen>
            <ScrollView contentContainerStyle={styles.content}>
                <ScreenHeader title={tNav('account')} />

                <Card variant="raised" padding="lg" style={styles.hero}>
                    <View style={styles.heroIcon}>
                        <IconSymbol name="account" size={26} color="brand" />
                    </View>
                    <Text variant="heading">{t('signIn')}</Text>
                    <Text variant="body" color="textMuted">
                        {t('welcomeBack')}
                    </Text>
                    <Button fullWidth size="lg" onPress={() => router.push('/auth/sign-in')}>
                        {t('signIn')}
                    </Button>
                    <Button
                        variant="secondary"
                        fullWidth
                        onPress={() => router.push('/auth/register')}
                    >
                        {t('createAccount')}
                    </Button>
                </Card>

                <View style={styles.benefits}>
                    <Benefit icon="truck" label={`${t('featureFast')} ${t('featureCheckout')}`} />
                    <Benefit icon="package" label={`${t('featureEasy')} ${t('featureReturns')}`} />
                    <Benefit icon="lock" label={`${t('featureSecure')} ${t('featurePayments')}`} />
                </View>

                <Section title={tNav('links')}>
                    <BrowseLinks />
                </Section>
            </ScrollView>
        </Screen>
    );
}

function Benefit({icon, label}: {icon: 'truck' | 'package' | 'lock'; label: string}) {
    return (
        <View style={styles.benefit}>
            <IconSymbol name={icon} size={18} color="brand" />
            <Text variant="micro" color="textMuted" align="center">
                {label}
            </Text>
        </View>
    );
}

/* ----------------------------------------------------------------- pieces */

function BrowseLinks() {
    const tNav = useT('Navigation');
    const router = useRouter();
    const {locale} = useLocale();
    const [languageOpen, setLanguageOpen] = useState(false);

    return (
        <>
            <RowGroup>
                <LinkRow icon="heart" title={tNav('wishlist')} onPress={() => router.push('/wishlist')} />
                <LinkRow icon="compare" title={tNav('compare')} onPress={() => router.push('/compare')} />
                <LinkRow icon="calculator" title={tNav('tools')} onPress={() => router.push('/tools')} />
                <LinkRow icon="article" title={translate('HomeSections.blog.title')} onPress={() => router.push('/blog')} />
                {/* The only way to reach French and Arabic. Without this the
                    other two thirds of the catalogue's audience are stuck on
                    whatever the device locale happened to be. */}
                <LinkRow
                    icon="globe"
                    title={tNav('switchLanguage')}
                    value={localeNames[locale]}
                    onPress={() => setLanguageOpen(true)}
                />
            </RowGroup>

            <LanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} />
        </>
    );
}

function Stats() {
    const t = useT('Account');
    const orders = useOrders({take: 5});
    const addresses = useAddresses();

    return (
        <View style={styles.stats}>
            <Stat
                label={t('statOrders')}
                value={orders.isPending ? '—' : String(orders.data?.totalItems ?? 0)}
            />
            <Stat
                label={t('statAddresses')}
                value={addresses.isPending ? '—' : String(addresses.data?.length ?? 0)}
            />
            <Stat label={t('statAccount')} value={t('statAccountActive')} tabular={false} />
        </View>
    );
}

function Stat({label, value, tabular = true}: {label: string; value: string; tabular?: boolean}) {
    return (
        <Card padding="md" style={styles.stat}>
            <Text variant="heading" tabular={tabular} numberOfLines={1}>
                {value}
            </Text>
            <Text variant="micro" color="textMuted" uppercase>
                {label}
            </Text>
        </Card>
    );
}

function RecentOrders() {
    const t = useT('Account');
    const router = useRouter();
    const orders = useOrders({take: 3});

    if (orders.isPending) {
        return (
            <Section title={t('recentOrders')}>
                <Skeleton height={72} radius="lg" />
            </Section>
        );
    }

    const items = orders.data?.orders ?? [];
    if (items.length === 0) {
        return (
            <Section title={t('recentOrders')}>
                <Card padding="lg" style={styles.emptyCard}>
                    <Text variant="bodyStrong">{t('noOrdersTitle')}</Text>
                    <Button size="sm" onPress={() => router.push('/shop')}>
                        {t('startShopping')}
                    </Button>
                </Card>
            </Section>
        );
    }

    return (
        <Section
            title={t('recentOrders')}
            action={{label: t('viewAllOrders'), onPress: () => router.push('/account/orders')}}
        >
            <RowGroup>
                {items.map(order => (
                    <LinkRow
                        key={order.id}
                        icon="receipt"
                        title={t('order', {code: order.code})}
                        subtitle={translate(`OrderStatus.${order.state}`)}
                        onPress={() => router.push(`/account/orders/${order.code}`)}
                    />
                ))}
            </RowGroup>
        </Section>
    );
}

function SignOutRow() {
    const tNav = useT('Navigation');
    const t = useT('Account');
    const signOut = useSignOut();

    // Confirmed, because on a shared phone an accidental sign-out costs a
    // password the user may not remember.
    const confirm = useCallback(() => {
        Alert.alert(tNav('signOut'), t('deleteConfirmTitle'), [
            {text: t('cancel'), style: 'cancel'},
            {
                text: tNav('signOut'),
                style: 'destructive',
                onPress: () => signOut.mutate(),
            },
        ]);
    }, [signOut, t, tNav]);

    return (
        <RowGroup>
            <LinkRow icon="logout" tone="danger" title={tNav('signOut')} onPress={confirm} />
        </RowGroup>
    );
}

function Section({
    title,
    action,
    children,
}: {
    title: string;
    action?: {label: string; onPress: () => void};
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text variant="heading" style={styles.sectionTitle}>
                    {title}
                </Text>
                {action ? (
                    <Button variant="ghost" size="sm" onPress={action.onPress}>
                        {action.label}
                    </Button>
                ) : null}
            </View>
            {children}
        </View>
    );
}

function AccountSkeleton() {
    return (
        <Screen>
            <View style={styles.content}>
                <Skeleton width="60%" height={28} />
                <Skeleton height={72} radius="lg" />
                <Skeleton height={200} radius="lg" />
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingBottom: theme.spacing['3xl'],
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.lg,
    },
    hero: {
        gap: theme.spacing.md,
        alignItems: 'stretch',
    },
    heroIcon: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.brandMuted,
    },
    benefits: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    benefit: {
        flex: 1,
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
    },
    optIn: {paddingHorizontal: theme.spacing.lg},
    stats: {
        flexDirection: 'row',
        gap: theme.spacing.sm,
    },
    stat: {
        flex: 1,
        gap: theme.spacing.xs,
    },
    section: {
        gap: theme.spacing.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {flex: 1},
    emptyCard: {
        alignItems: 'center',
        gap: theme.spacing.md,
    },
}));
