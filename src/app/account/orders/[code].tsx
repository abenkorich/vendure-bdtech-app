import {ScrollView, View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {Screen, Text, Price, Card, Divider, Skeleton, EmptyState} from '@/components/ui';
import {useOrder, type OrderDetail} from '@/features/account/queries';
import {BackHeader} from '@/features/account/components/chrome';
import {OrderTimeline, OrderStateBadge} from '@/features/account/components/OrderTimeline';
import {useT, useActiveLocale, translate} from '@/features/account/i18n';
import {formatDate} from '@/lib/format';

/**
 * Order detail.
 *
 * `useOrder` is intentionally usable by a guest too (Vendure authorises
 * `orderByCode` against the session that placed it), so this screen doubles as
 * the post-checkout confirmation without a second implementation.
 */
export default function OrderDetailScreen() {
    const t = useT('Account');
    const router = useRouter();
    const locale = useActiveLocale();
    const {code} = useLocalSearchParams<{code: string}>();
    const order = useOrder(code);

    if (order.isPending) {
        return (
            <Screen>
                <BackHeader title={t('order', {code: code ?? ''})} />
                <View style={styles.content}>
                    <Skeleton height={80} radius="lg" />
                    <Skeleton height={160} radius="lg" />
                    <Skeleton height={200} radius="lg" />
                </View>
            </Screen>
        );
    }

    if (order.error || !order.data) {
        return (
            <Screen>
                <BackHeader title={t('order', {code: code ?? ''})} />
                <EmptyState
                    tone="error"
                    title={translate('Errors.somethingWentWrong')}
                    message={order.error?.message ?? translate('Errors.unexpectedError')}
                    action={{label: t('backToOrders'), onPress: () => router.back()}}
                />
            </Screen>
        );
    }

    const data = order.data;

    return (
        <Screen>
            <BackHeader
                title={t('order', {code: data.code})}
                subtitle={t('placedOn', {
                    date: formatDate(data.createdAt as string, 'long', locale),
                })}
            />

            <ScrollView contentContainerStyle={styles.content}>
                <Card padding="lg" style={styles.block}>
                    <View style={styles.blockHeader}>
                        <Text variant="bodyStrong">{t('orderProgress')}</Text>
                        <OrderStateBadge state={data.state} />
                    </View>
                    <OrderTimeline state={data.state} />
                </Card>

                <Fulfillments order={data} />

                <Card padding="lg" style={styles.block}>
                    <Text variant="bodyStrong">{t('orderItems')}</Text>
                    {data.lines.map((line, index) => (
                        <View key={line.id}>
                            {index > 0 ? <Divider /> : null}
                            <View style={styles.line}>
                                {line.productVariant.product.featuredAsset?.preview ? (
                                    <Image
                                        source={{uri: line.productVariant.product.featuredAsset.preview}}
                                        style={styles.thumb}
                                        contentFit="cover"
                                        transition={150}
                                    />
                                ) : (
                                    <View style={[styles.thumb, styles.thumbEmpty]} />
                                )}
                                <View style={styles.lineText}>
                                    <Text variant="bodyStrong" numberOfLines={2}>
                                        {line.productVariant.name}
                                    </Text>
                                    <Text variant="micro" color="textMuted" tabular>
                                        {t('skuLabel', {sku: line.productVariant.sku})}
                                    </Text>
                                    <Text variant="micro" color="textMuted" tabular>
                                        {t('qty', {quantity: line.quantity})}
                                    </Text>
                                </View>
                                <Price
                                    value={line.linePriceWithTax}
                                    currencyCode={data.currencyCode}
                                    tone="text"
                                />
                            </View>
                        </View>
                    ))}
                </Card>

                <Card padding="lg" style={styles.block}>
                    <Text variant="bodyStrong">{t('orderSummary')}</Text>
                    <SummaryRow
                        label={t('subtotal')}
                        value={data.subTotalWithTax}
                        currency={data.currencyCode}
                    />
                    <SummaryRow
                        label={t('shipping')}
                        value={data.shippingWithTax}
                        currency={data.currencyCode}
                    />
                    {data.discounts.map(discount => (
                        <SummaryRow
                            key={discount.description}
                            label={discount.description}
                            value={discount.amountWithTax}
                            currency={data.currencyCode}
                        />
                    ))}
                    <Divider />
                    <View style={styles.summaryRow}>
                        <Text variant="bodyStrong">{t('total')}</Text>
                        <Price value={data.totalWithTax} currencyCode={data.currencyCode} size="lg" />
                    </View>
                </Card>

                {data.shippingAddress ? (
                    <Card padding="lg" style={styles.block}>
                        <Text variant="bodyStrong">{t('shippingAddress')}</Text>
                        {[
                            data.shippingAddress.fullName,
                            data.shippingAddress.company,
                            data.shippingAddress.streetLine1,
                            data.shippingAddress.streetLine2,
                            [data.shippingAddress.city, data.shippingAddress.province]
                                .filter(Boolean)
                                .join(', '),
                            data.shippingAddress.postalCode,
                            data.shippingAddress.country,
                            data.shippingAddress.phoneNumber,
                        ]
                            .filter(Boolean)
                            .map((row, index) => (
                                 
                                <Text key={index} variant="caption" color="textMuted">
                                    {row}
                                </Text>
                            ))}
                    </Card>
                ) : null}

                {data.payments && data.payments.length > 0 ? (
                    <Card padding="lg" style={styles.block}>
                        <Text variant="bodyStrong">{t('payment')}</Text>
                        {data.payments.map(payment => (
                            <View key={payment.id} style={styles.block}>
                                <KeyValue label={t('method')} value={payment.method} />
                                <KeyValue label={t('paymentStatus')} value={payment.state} />
                                {payment.transactionId ? (
                                    <KeyValue
                                        label={t('transactionId')}
                                        value={payment.transactionId}
                                    />
                                ) : null}
                                <View style={styles.summaryRow}>
                                    <Text variant="caption" color="textMuted">
                                        {t('amount')}
                                    </Text>
                                    <Price
                                        value={payment.amount}
                                        currencyCode={data.currencyCode}
                                        tone="text"
                                    />
                                </View>
                            </View>
                        ))}
                    </Card>
                ) : null}
            </ScrollView>
        </Screen>
    );
}

function Fulfillments({order}: {order: OrderDetail}) {
    const t = useT('Account');
    const locale = useActiveLocale();
    const fulfillments = order.fulfillments ?? [];

    if (fulfillments.length === 0) {
        if (order.state === 'Delivered' || order.state === 'Shipped') return null;
        return (
            <Card padding="lg" style={styles.block}>
                <Text variant="bodyStrong">{t('tracking')}</Text>
                <Text variant="caption" color="textMuted">
                    {t('trackingPending')}
                </Text>
            </Card>
        );
    }

    return (
        <Card padding="lg" style={styles.block}>
            <Text variant="bodyStrong">{t('tracking')}</Text>
            {fulfillments.map(fulfillment => (
                <View key={fulfillment.id} style={styles.block}>
                    <KeyValue label={t('shipment')} value={fulfillment.method} />
                    <KeyValue label={t('status')} value={fulfillment.state} />
                    {fulfillment.trackingCode ? (
                        <KeyValue label={t('trackingCode')} value={fulfillment.trackingCode} />
                    ) : null}
                    <KeyValue
                        label={t('dateUpdated')}
                        value={formatDate(fulfillment.updatedAt as string, 'short', locale)}
                    />
                </View>
            ))}
        </Card>
    );
}

function SummaryRow({label, value, currency}: {label: string; value: number; currency: string}) {
    return (
        <View style={styles.summaryRow}>
            <Text variant="caption" color="textMuted">
                {label}
            </Text>
            <Price value={value} currencyCode={currency} tone="text" size="sm" />
        </View>
    );
}

function KeyValue({label, value}: {label: string; value: string}) {
    return (
        <View style={styles.summaryRow}>
            <Text variant="caption" color="textMuted">
                {label}
            </Text>
            <Text variant="caption" tabular numberOfLines={1} style={styles.kvValue}>
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.md,
    },
    block: {
        gap: theme.spacing.sm,
    },
    blockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
    },
    line: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
    },
    lineText: {flex: 1, gap: 2},
    thumb: {
        width: 48,
        height: 48,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceElevated,
    },
    thumbEmpty: {
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    kvValue: {flexShrink: 1},
}));
