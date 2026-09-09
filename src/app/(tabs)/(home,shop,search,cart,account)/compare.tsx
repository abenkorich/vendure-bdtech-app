import {useCallback, useMemo, useState} from 'react';
import {Alert, ScrollView, View} from 'react-native';
import {Image} from 'expo-image';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {useQueries} from '@tanstack/react-query';
import {
    Screen,
    Text,
    Price,
    Button,
    Divider,
    EmptyState,
    IconSymbol,
} from '@/components/ui';
import {useTranslations} from '@/i18n';
import {BackHeader, Segmented} from '@/features/account/components/chrome';
import {useCompare} from '@/features/wishlist/store';
import {queryKeys} from '@/lib/query-keys';
import {query} from '@/lib/vendure/api';
import {GetProductDetailQuery} from '@/lib/vendure/queries';
import {
    buildCompareMatrix,
    differingRows,
    type CompareColumn,
} from '@/features/compare/matrix';

/**
 * Compare.
 *
 * A real spec table, because that is what comparing electronics *is*: the
 * decision between two relay boards is made on coil voltage, channel count and
 * stock, read down a column. Four cards side by side showing the same facts in
 * different vertical positions is not comparable, and that is the mistake this
 * screen exists to avoid. See `features/compare/matrix.ts` for the row rules.
 *
 * The table scrolls horizontally with a **pinned attribute column**: on a phone
 * four columns cannot fit, and a table whose row labels scroll away is
 * unreadable after the first swipe.
 *
 * "Differences only" is the default-off filter that makes a long table usable —
 * two products in the same family agree on most rows, and the three that differ
 * are the entire question.
 */

const COLUMN_WIDTH = 148;
const LABEL_WIDTH = 116;

export default function CompareScreen() {
    const t = useTranslations('Compare');
    const tProduct = useTranslations('Product');
    const tCommon = useTranslations('Common');
    const tFilters = useTranslations('Filters');
    const router = useRouter();

    const compare = useCompare();
    const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);

    // One product document per saved slug, through the same cache the detail
    // screen fills — opening compare after browsing is usually free.
    const details = useQueries({
        queries: compare.items.map(item => ({
            queryKey: queryKeys.product(item.slug),
            queryFn: async ({signal}: {signal: AbortSignal}) => {
                const {data} = await query(GetProductDetailQuery, {slug: item.slug}, {signal});
                return data.product ?? null;
            },
        })),
    });

    const columns: CompareColumn[] = useMemo(
        () =>
            compare.items.map((item, index) => ({
                slug: item.slug,
                name: item.name,
                priceWithTax: item.priceWithTax,
                currencyCode: item.currencyCode,
                imageUrl: item.imageUrl,
                detail: details[index]?.data ?? null,
            })),
        [compare.items, details],
    );

    const labels = useMemo(
        () => ({
            sku: tCommon('sku'),
            availability: tFilters('availability'),
            inStock: tProduct('inStock'),
            outOfStock: tProduct('outOfStock'),
            lowStock: tProduct('lowStock'),
            rating: t('rating'),
            reviews: t('reviews'),
            variants: t('variants'),
            category: t('category'),
        }),
        [t, tProduct, tCommon, tFilters],
    );

    const allRows = useMemo(() => buildCompareMatrix(columns, labels), [columns, labels]);
    const rows = showDifferencesOnly ? differingRows(allRows) : allRows;

    const loading = details.some(result => result.isPending);

    const confirmClear = useCallback(() => {
        Alert.alert(t('clearAllTitle'), t('clearAllMessage'), [
            {text: t('cancel'), style: 'cancel'},
            {text: t('clearAll'), style: 'destructive', onPress: () => compare.clear()},
        ]);
    }, [t, compare]);

    if (compare.count === 0) {
        return (
            <Screen>
                <BackHeader title={t('title')} />
                <View style={styles.centered}>
                    <EmptyState
                        icon="compare"
                        title={t('emptyTitle')}
                        message={t('emptyMessage')}
                        action={{
                            label: t('startShopping'),
                            onPress: () => router.replace('/shop'),
                        }}
                    />
                </View>
            </Screen>
        );
    }

    return (
        <Screen>
            <BackHeader
                title={t('title')}
                subtitle={t('count', {count: compare.count})}
                trailing={
                    <Button variant="ghost" size="sm" icon="trash" onPress={confirmClear}>
                        {t('clearAll')}
                    </Button>
                }
            />

            <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
                <View style={styles.controls}>
                    <Segmented
                        label={t('title')}
                        value={showDifferencesOnly ? 'differences' : 'all'}
                        options={[
                            {value: 'all', label: t('allSpecs')},
                            {value: 'differences', label: t('differencesOnly')},
                        ]}
                        onChange={value => setShowDifferencesOnly(value === 'differences')}
                    />
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tableScroll}
                    // The pinned label column is outside this scroll view, so
                    // the table body is what moves.
                >
                    <View>
                        {/* header: one card per product */}
                        <View style={styles.headerRow}>
                            <View style={styles.labelCell}>
                                <Text variant="micro" color="textMuted" uppercase>
                                    {t('specification')}
                                </Text>
                            </View>

                            {columns.map(column => (
                                <View key={column.slug} style={styles.headerCell}>
                                    <View style={styles.thumbWrap}>
                                        {column.imageUrl ? (
                                            <Image
                                                source={{uri: column.imageUrl}}
                                                style={styles.thumb}
                                                contentFit="cover"
                                                transition={120}
                                            />
                                        ) : (
                                            <View style={[styles.thumb, styles.thumbEmpty]} />
                                        )}
                                        {/* Remove sits on the image rather than
                                            beside "View product": two buttons
                                            side by side overflow a 148pt
                                            column and the label truncates. */}
                                        <View style={styles.removeButton}>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                icon="close"
                                                accessibilityLabel={t('remove')}
                                                onPress={() => compare.remove(column.slug)}
                                            />
                                        </View>
                                    </View>

                                    <Text variant="caption" numberOfLines={3}>
                                        {column.name}
                                    </Text>

                                    <Price
                                        value={column.priceWithTax}
                                        currencyCode={column.currencyCode}
                                        size="sm"
                                    />

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onPress={() => router.push(`/product/${column.slug}`)}
                                    >
                                        {t('viewProduct')}
                                    </Button>
                                </View>
                            ))}
                        </View>

                        <Divider />

                        {rows.length === 0 ? (
                            <View style={styles.emptyRows}>
                                <Text variant="caption" color="textMuted">
                                    {loading ? tCommon('loading') : t('noDifferences')}
                                </Text>
                            </View>
                        ) : (
                            rows.map((row, index) => (
                                <View key={row.label}>
                                    {index > 0 ? <Divider /> : null}
                                    <View
                                        style={[
                                            styles.row,
                                            // Zebra striping is what keeps the
                                            // eye on one row across four
                                            // columns of a wide table.
                                            index % 2 === 1 && styles.rowAlt,
                                        ]}
                                    >
                                        <View style={styles.labelCell}>
                                            <Text
                                                variant="micro"
                                                color="textMuted"
                                                numberOfLines={3}
                                            >
                                                {row.label}
                                            </Text>
                                            {row.differs ? (
                                                <IconSymbol
                                                    name="info"
                                                    size={11}
                                                    color="brand"
                                                />
                                            ) : null}
                                        </View>

                                        {row.values.map((value, columnIndex) => (
                                            <View
                                                key={`${row.label}-${columns[columnIndex]?.slug ?? columnIndex}`}
                                                style={styles.valueCell}
                                            >
                                                <Text
                                                    variant="caption"
                                                    tabular
                                                    color={value ? 'text' : 'textMuted'}
                                                    numberOfLines={3}
                                                >
                                                    {/* An em dash, not an empty
                                                        cell, which reads as a
                                                        rendering failure. */}
                                                    {value ?? '—'}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </ScrollView>

                <Text variant="micro" color="textMuted" align="center">
                    {t('limitNote', {count: compare.limit})}
                </Text>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    page: {paddingBottom: theme.spacing['3xl'], gap: theme.spacing.md},
    centered: {flex: 1, justifyContent: 'center'},
    controls: {paddingHorizontal: theme.spacing.lg},
    tableScroll: {paddingHorizontal: theme.spacing.lg},
    headerRow: {flexDirection: 'row', alignItems: 'flex-start', paddingBottom: theme.spacing.md},
    headerCell: {
        width: COLUMN_WIDTH,
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
    },
    thumbWrap: {position: 'relative'},
    removeButton: {
        position: 'absolute',
        top: theme.spacing.xs,
        // Logical inset, so the button sits at the trailing corner in Arabic
        // too rather than jumping across the card.
        insetInlineEnd: theme.spacing.xs,
    },
    thumb: {
        width: '100%',
        height: 88,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
    },
    thumbEmpty: {
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    row: {flexDirection: 'row', alignItems: 'flex-start', paddingVertical: theme.spacing.md},
    rowAlt: {backgroundColor: theme.colors.surface},
    labelCell: {
        width: LABEL_WIDTH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingEnd: theme.spacing.sm,
    },
    valueCell: {width: COLUMN_WIDTH, paddingHorizontal: theme.spacing.sm},
    emptyRows: {paddingVertical: theme.spacing.xl, alignItems: 'center'},
}));
