import {ScrollView, View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {
    Screen,
    Text,
    Price,
    Card,
    Divider,
    Button,
    Badge,
    Skeleton,
    EmptyState,
    IconSymbol,
} from '@/components/ui';
import {useTranslations, useLocale} from '@/i18n';
import {useOrder} from '@/features/account/queries';
import {
    OrderTimeline,
    orderStateLabel,
    orderStateTone,
} from '@/features/account/components/OrderTimeline';
import {presentError} from '@/features/cart/errors';
import {plainDescription} from '@/features/checkout/delivery';
import {formatDate} from '@/lib/format';

/**
 * Order confirmation and detail.
 *
 * Reached two ways, and it must work for both: pushed straight after checkout
 * (from `/checkout`), and opened later from a link or the account area. That is
 * why it reads `orderByCode` through `useOrder`, which does not require a
 * signed-in customer — Vendure authorises a recently placed order against the
 * session that placed it, and most orders here are placed by guests. A
 * confirmation screen that only worked for account holders would show "not
 * found" to the majority of this store's customers.
 *
 * There is deliberately no back button in the header. Arriving here means the
 * order exists; going "back" would land on a checkout for an order that is no
 * longer active. The two exits are "keep shopping" and "my orders".
 *
 * For a cash-on-delivery order the state after placing is `ArrangingPayment`,
 * which reads alarmingly like a failure. So the confirmation copy leads with
 * what actually happens next — the courier calls, and cash is due on delivery —
 * and the raw state is shown as a badge rather than as the headline.
 */
export default function OrderScreen() {
    const t = useTranslations('OrderConfirmation');
    const tCheckout = useTranslations('Checkout');
    const tAccount = useTranslations('Account');
    const {locale} = useLocale();
    const router = useRouter();
    const {code} = useLocalSearchParams<{code: string}>();

    const order = useOrder(code);

    if (order.isPending) {
        return (
            <Screen>
                <View style={styles.content}>
                    <Skeleton height={120} radius="lg" />
                    <Skeleton height={160} radius="lg" />
                    <Skeleton height={200} radius="lg" />
                </View>
            </Screen>
        );
    }

    if (order.error || !order.data) {
        const presented = order.error ? presentError(order.error) : null;
        // Vendure answers an unknown or foreign order code with "You are not
        // currently authorized to perform this action". That is accurate and
        // useless: from the customer's side the order simply is not theirs to
        // see, so our own copy replaces it. A reachability failure keeps its
        // own message, because that one is actionable.
        const message =
            presented?.retryable === true
                ? presented.message
                : tCheckout('orderNotFoundMessage');

        return (
            <Screen>
                <View style={styles.centered}>
                    <EmptyState
                        tone="error"
                        title={tCheckout('orderNotFound')}
                        message={message}
                        action={{
                            label: t('continueShopping'),
                            onPress: () => router.replace('/'),
                        }}
                        secondaryAction={
                            presented?.retryable
                                ? {
                                      label: tCheckout('tryAgain'),
                                      onPress: () => void order.refetch(),
                                  }
                                : undefined
                        }
                    />
                </View>
            </Screen>
        );
    }

    const data = order.data;
    const currencyCode = data.currencyCode;
    const address = data.shippingAddress;
    const shippingLine = data.shippingLines?.[0];
    const tax = data.subTotalWithTax - data.subTotal;

    return (
        <Screen>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={styles.heroIcon}>
                        <IconSymbol name="checkCircle" size={32} color="success" />
                    </View>
                    <Text variant="title" align="center">
                        {t('orderConfirmed')}
                    </Text>
                    <Text variant="body" color="textMuted" align="center">
                        {t('thankYou')}
                    </Text>
                    <Text variant="heading" color="brand" tabular align="center">
                        {data.code}
                    </Text>
                    <Text variant="caption" color="textMuted" align="center">
                        {tCheckout('codNextSteps')}
                    </Text>
                </View>

                <Card padding="lg" style={styles.block}>
                    <View style={styles.blockHeader}>
                        <Text variant="bodyStrong">{tAccount('orderProgress')}</Text>
                        <Badge tone={orderStateTone(data.state)}>
                            {orderStateLabel(data.state)}
                        </Badge>
                    </View>
                    <Text variant="micro" color="textMuted" tabular>
                        {tAccount('placedOn', {
                            date: formatDate(data.createdAt as string, 'long', locale),
                        })}
                    </Text>
                    <OrderTimeline state={data.state} />
                </Card>

                <Card padding="lg" style={styles.block}>
                    <Text variant="bodyStrong">{tAccount('orderItems')}</Text>

                    {data.lines.map((line, index) => (
                        <View key={line.id}>
                            {index > 0 ? <Divider /> : null}
                            <View style={styles.line}>
                                {line.productVariant.product.featuredAsset?.preview ? (
                                    <Image
                                        source={{
                                            uri: line.productVariant.product.featuredAsset.preview,
                                        }}
                                        style={styles.thumb}
                                        contentFit="cover"
                                        transition={120}
                                    />
                                ) : (
                                    <View style={[styles.thumb, styles.thumbEmpty]} />
                                )}

                                <View style={styles.lineBody}>
                                    <Text variant="caption" numberOfLines={2}>
                                        {line.productVariant.name}
                                    </Text>
                                    <Text variant="micro" color="textMuted" tabular>
                                        {tAccount('skuLabel', {sku: line.productVariant.sku})}
                                    </Text>
                                    <Text variant="micro" color="textMuted" tabular>
                                        {t('qty', {quantity: line.quantity})}
                                    </Text>
                                </View>

                                <Price
                                    value={line.linePriceWithTax}
                                    currencyCode={currencyCode}
                                    size="sm"
                                    tone="text"
                                />
                            </View>
                        </View>
                    ))}

                    <Divider />

                    <Row label={tAccount('subtotal')}>
                        <Price
                            value={data.subTotal}
                            currencyCode={currencyCode}
                            size="sm"
                            tone="text"
                        />
                    </Row>

                    {tax > 0 ? (
                        <Row label={tCheckout('tax')}>
                            <Price
                                value={tax}
                                currencyCode={currencyCode}
                                size="sm"
                                tone="text"
                            />
                        </Row>
                    ) : null}

                    <Row label={tAccount('shipping')}>
                        <Price
                            value={data.shippingWithTax}
                            currencyCode={currencyCode}
                            size="sm"
                            tone="text"
                        />
                    </Row>

                    <View style={styles.totalRow}>
                        <Text variant="bodyStrong">{t('total')}</Text>
                        <Price value={data.totalWithTax} currencyCode={currencyCode} size="lg" />
                    </View>
                </Card>

                <Card padding="lg" style={styles.block}>
                    <Text variant="bodyStrong">{tCheckout('deliveryDetails')}</Text>

                    {shippingLine ? (
                        <View style={styles.detail}>
                            <Text variant="caption" color="textMuted">
                                {tAccount('shippingMethod')}
                            </Text>
                            <Text variant="caption">{shippingLine.shippingMethod.name}</Text>
                            {plainDescription(shippingLine.shippingMethod.description) ? (
                                <Text variant="micro" color="textMuted">
                                    {plainDescription(shippingLine.shippingMethod.description)}
                                </Text>
                            ) : null}
                        </View>
                    ) : null}

                    {address ? (
                        <View style={styles.detail}>
                            <Text variant="caption" color="textMuted">
                                {t('shippingAddress')}
                            </Text>
                            {[
                                address.fullName,
                                address.streetLine1,
                                address.streetLine2,
                                [address.city, address.province].filter(Boolean).join(', '),
                                address.country,
                                address.phoneNumber,
                            ]
                                .filter((value): value is string => Boolean(value?.trim()))
                                .map((value, index) => (
                                    <Text key={`${value}-${index}`} variant="caption">
                                        {value}
                                    </Text>
                                ))}
                        </View>
                    ) : null}

                    {data.payments?.length ? (
                        <View style={styles.detail}>
                            <Text variant="caption" color="textMuted">
                                {tAccount('payment')}
                            </Text>
                            {data.payments.map(payment => (
                                <View key={payment.id} style={styles.paymentRow}>
                                    <Text variant="caption">{payment.method}</Text>
                                    <Price
                                        value={payment.amount}
                                        currencyCode={currencyCode}
                                        size="sm"
                                        tone="text"
                                    />
                                </View>
                            ))}
                        </View>
                    ) : null}
                </Card>

                <Text variant="micro" color="textMuted" align="center">
                    {t('emailConfirmation')}
                </Text>

                <View style={styles.actions}>
                    <Button variant="primary" fullWidth onPress={() => router.replace('/')}>
                        {t('continueShopping')}
                    </Button>
                    <Button
                        variant="secondary"
                        fullWidth
                        onPress={() => router.replace('/account/orders')}
                    >
                        {t('viewOrders')}
                    </Button>
                </View>
            </ScrollView>
        </Screen>
    );
}

function Row({label, children}: {label: string; children: React.ReactNode}) {
    return (
        <View style={styles.row}>
            <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.rowLabel}>
                {label}
            </Text>
            {children}
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.md,
    },
    centered: {flex: 1, justifyContent: 'center'},
    hero: {
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xl,
    },
    heroIcon: {
        width: 64,
        height: 64,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.success,
    },
    block: {gap: theme.spacing.md},
    blockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    line: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md},
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
    lineBody: {flex: 1, gap: theme.spacing.xs},
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    rowLabel: {flexShrink: 1},
    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingTop: theme.spacing.xs,
    },
    detail: {gap: theme.spacing.xs},
    paymentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    actions: {gap: theme.spacing.sm, paddingTop: theme.spacing.md},
}));
