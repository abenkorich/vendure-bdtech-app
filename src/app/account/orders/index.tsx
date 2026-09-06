import {useMemo, useState} from 'react';
import {FlatList, Pressable, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Screen, Text, Price, Card, Skeleton, EmptyState, IconSymbol} from '@/components/ui';
import {useSession} from '@/features/auth/queries';
import {useOrders, type CustomerOrderSummary} from '@/features/account/queries';
import {BackHeader, Segmented} from '@/features/account/components/chrome';
import {OrderStateBadge} from '@/features/account/components/OrderTimeline';
import {useT, useActiveLocale} from '@/features/account/i18n';
import {formatDate} from '@/lib/format';

/**
 * Order history.
 *
 * Filtering is client-side over the fetched page rather than a server query:
 * `OrderListOptions` filtering by state exists, but a customer's order list is
 * small and refetching on every chip tap would make the filter feel laggier
 * than it is useful. If a customer ever has hundreds of orders this becomes a
 * server filter, not before.
 */
type Filter = 'all' | 'open' | 'delivered';

const OPEN_STATES = new Set([
    'AddingItems',
    'ArrangingPayment',
    'PaymentAuthorized',
    'PaymentSettled',
    'PartiallyShipped',
    'Shipped',
    'PartiallyDelivered',
]);

export default function OrdersScreen() {
    const t = useT('Account');
    const router = useRouter();
    const session = useSession();
    const orders = useOrders({take: 50});
    const [filter, setFilter] = useState<Filter>('all');

    const items = useMemo(() => {
        const all = orders.data?.orders ?? [];
        if (filter === 'open') return all.filter(order => OPEN_STATES.has(order.state));
        if (filter === 'delivered') return all.filter(order => order.state === 'Delivered');
        return all;
    }, [orders.data, filter]);

    if (!session.isLoading && !session.isSignedIn) {
        return (
            <Screen>
                <BackHeader title={t('myOrders')} />
                <EmptyState
                    icon="lock"
                    title={t('myOrders')}
                    message={t('noOrders')}
                    action={{label: t('quickOrders'), onPress: () => router.replace('/auth/sign-in')}}
                />
            </Screen>
        );
    }

    return (
        <Screen>
            <BackHeader title={t('myOrders')} subtitle={t('ordersSubtitle')} />

            <View style={styles.filters}>
                <Segmented
                    label={t('filterByStatus')}
                    value={filter}
                    onChange={setFilter}
                    options={[
                        {value: 'all', label: t('allStatuses')},
                        {value: 'open', label: t('timeline.Shipped')},
                        {value: 'delivered', label: t('timeline.Delivered')},
                    ]}
                />
            </View>

            {orders.isPending ? (
                <View style={styles.list}>
                    <Skeleton height={96} radius="lg" />
                    <Skeleton height={96} radius="lg" />
                    <Skeleton height={96} radius="lg" />
                </View>
            ) : orders.error ? (
                <EmptyState
                    tone="error"
                    title={t('noMatchingOrdersTitle')}
                    message={orders.error.message}
                    action={{label: t('clearFilters'), onPress: () => orders.refetch()}}
                />
            ) : items.length === 0 ? (
                <EmptyState
                    icon="receipt"
                    title={filter === 'all' ? t('noOrdersTitle') : t('noMatchingOrdersTitle')}
                    message={filter === 'all' ? t('noOrders') : t('noMatchingOrders')}
                    action={
                        filter === 'all'
                            ? {label: t('startShopping'), onPress: () => router.push('/shop')}
                            : {label: t('clearFilters'), onPress: () => setFilter('all')}
                    }
                />
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={order => order.id}
                    contentContainerStyle={styles.list}
                    refreshing={orders.isRefetching}
                    onRefresh={() => orders.refetch()}
                    renderItem={({item}) => (
                        <OrderRow
                            order={item}
                            onPress={() => router.push(`/account/orders/${item.code}`)}
                        />
                    )}
                />
            )}
        </Screen>
    );
}

function OrderRow({order, onPress}: {order: CustomerOrderSummary; onPress: () => void}) {
    const t = useT('Account');
    const locale = useActiveLocale();
    const count = order.lines.length;

    return (
        <Pressable accessibilityRole="button" onPress={onPress}>
            <Card padding="md" style={styles.card}>
                <View style={styles.cardRow}>
                    <Text variant="bodyStrong" tabular>
                        {order.code}
                    </Text>
                    <OrderStateBadge state={order.state} />
                </View>

                <View style={styles.cardRow}>
                    <Text variant="caption" color="textMuted" tabular>
                        {formatDate(order.createdAt as string, 'short', locale)}
                    </Text>
                    <Text variant="caption" color="textMuted" tabular>
                        {`${count} ${count === 1 ? t('item') : t('items')}`}
                    </Text>
                </View>

                <View style={styles.cardRow}>
                    {/* Money is integer minor units; <Price> owns the divide. */}
                    <Price value={order.totalWithTax} currencyCode={order.currencyCode} />
                    <IconSymbol name="chevronForward" size={16} color="textMuted" />
                </View>
            </Card>
        </Pressable>
    );
}

const styles = StyleSheet.create(theme => ({
    filters: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
    },
    list: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.md,
    },
    card: {
        gap: theme.spacing.sm,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
    },
}));
