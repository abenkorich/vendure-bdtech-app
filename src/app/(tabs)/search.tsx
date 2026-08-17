import {useCallback, useMemo, useRef, useState} from 'react';
import {Keyboard, KeyboardAvoidingView, Platform, View, type TextInput} from 'react-native';
import {router} from 'expo-router';
import {StyleSheet} from 'react-native-unistyles';
import {Screen, Text, Button} from '@/components/ui';
import {
    EMPTY_FILTERS,
    FilterBar,
    FilterSheet,
    NoResults,
    ResultGrid,
    ResultGridSkeleton,
    SearchField,
    SearchStart,
    activeFilterCount,
    useDebouncedValue,
    useFilteredSearch,
    useRecentSearches,
    useTranslations,
    type FilterState,
} from '@/features/search';
import {usePriceBounds} from '@/features/search/queries';

/**
 * Search.
 *
 * The screen composes; it fetches nothing itself. Three pieces of state and
 * everything else is derived:
 *
 *  - `term`      — updated on every keystroke, so the field never lags.
 *  - `filters`   — committed by the sheet, never mid-edit.
 *  - `page`      — bumped by the grid reaching its end.
 *
 * `debouncedTerm` is the only thing a query key is built from. That split is
 * the whole reason typing feels instant: a keystroke re-renders one TextInput,
 * not a request.
 */

/** Long enough to skip the noise of a fast typist, short enough to feel live. */
const DEBOUNCE_MS = 250;

/** Verified channel fact (AGENTS.md): this channel prices in DZD. */
const CURRENCY_CODE = 'DZD';

export default function SearchScreen() {
    const t = useTranslations('Search');
    const inputRef = useRef<TextInput>(null);

    const [term, setTerm] = useState('');
    const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
    const [page, setPage] = useState(1);
    const [sheetOpen, setSheetOpen] = useState(false);

    const debouncedTerm = useDebouncedValue(term, DEBOUNCE_MS);
    const {recent, push, remove, clear} = useRecentSearches();

    const search = useFilteredSearch(debouncedTerm, filters, page);

    // Bounds follow the term but not the price window, so the endpoints shown
    // in the sheet never collapse onto the handles the user just moved.
    const bounds = usePriceBounds(
        debouncedTerm.trim() ? {term: debouncedTerm.trim()} : {},
    );

    const activeCount = activeFilterCount(filters);

    const changeTerm = useCallback((next: string) => {
        setTerm(next);
        // A new term invalidates the accumulated pages; without this, typing
        // after scrolling would request 200 results for a one-letter query.
        setPage(1);
    }, []);

    const selectTerm = useCallback(
        (next: string) => {
            setTerm(next);
            setPage(1);
            push(next);
            Keyboard.dismiss();
        },
        [push],
    );

    /** Only a *submitted* term is worth remembering; a prefix typed on the way
     *  to a real query is not something the user wants to see again. */
    const submit = useCallback(() => {
        const trimmed = term.trim();
        if (trimmed) push(trimmed);
        Keyboard.dismiss();
    }, [term, push]);

    const applyFilters = useCallback((next: FilterState) => {
        setFilters(next);
        setPage(1);
    }, []);

    const clearQuery = useCallback(() => {
        setTerm('');
        setPage(1);
        inputRef.current?.focus();
    }, []);

    const openProduct = useCallback((slug: string) => {
        Keyboard.dismiss();
        router.push(`/product/${slug}`);
    }, []);

    const header = useMemo(
        () => (
            <FilterBar
                totalItems={search.isInitialLoading ? null : search.totalItems}
                activeCount={activeCount}
                filters={filters}
                onOpenFilters={() => {
                    Keyboard.dismiss();
                    setSheetOpen(true);
                }}
                isRefreshing={search.isRefreshing}
            />
        ),
        [search.isInitialLoading, search.totalItems, search.isRefreshing, activeCount, filters],
    );

    const footer = useMemo(
        () =>
            search.canLoadMore ? (
                <View style={styles.footer}>
                    <Text variant="caption" color="textMuted">
                        {t('searching')}
                    </Text>
                </View>
            ) : null,
        [search.canLoadMore, t],
    );

    const body = () => {
        if (!search.isActive) {
            return (
                <SearchStart
                    recent={recent}
                    onSelectTerm={selectTerm}
                    onRemoveRecent={remove}
                    onClearRecent={clear}
                />
            );
        }

        if (search.isError) {
            return (
                <View style={styles.state}>
                    <Text variant="heading" align="center">
                        {t('errorTitle')}
                    </Text>
                    <Text variant="body" color="textMuted" align="center">
                        {t('errorMessage')}
                    </Text>
                    <Button variant="secondary" icon="refresh" onPress={search.refetch}>
                        {t('retry')}
                    </Button>
                </View>
            );
        }

        if (search.isInitialLoading) {
            return (
                <View style={styles.loading}>
                    <FilterBar
                        totalItems={null}
                        activeCount={activeCount}
                        filters={filters}
                        onOpenFilters={() => setSheetOpen(true)}
                    />
                    <ResultGridSkeleton />
                </View>
            );
        }

        if (search.products.length === 0) {
            return (
                <NoResults
                    term={debouncedTerm.trim()}
                    hasFilters={activeCount > 0}
                    onClearFilters={() => applyFilters({...EMPTY_FILTERS, sort: filters.sort})}
                    onSelectTerm={selectTerm}
                    onClearQuery={clearQuery}
                />
            );
        }

        return (
            <ResultGrid
                products={search.products}
                onPressProduct={openProduct}
                header={header}
                footer={footer}
                onEndReached={() => {
                    if (search.canLoadMore && !search.isRefreshing) setPage(current => current + 1);
                }}
            />
        );
    };

    return (
        <Screen>
            {/* The field sits at the top, so only the sheet's own inputs need
                avoidance; `height` on Android would fight the grid's scroll. */}
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.head}>
                    <Text variant="title">{t('title')}</Text>
                    <SearchField
                        ref={inputRef}
                        value={term}
                        onChangeText={changeTerm}
                        onClear={clearQuery}
                        onSubmitEditing={submit}
                        placeholder={t('placeholder')}
                        clearLabel={t('clearQuery')}
                    />
                </View>

                <View style={styles.flex}>{body()}</View>
            </KeyboardAvoidingView>

            <FilterSheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                value={filters}
                onApply={applyFilters}
                facetValues={search.facetValues}
                bounds={bounds.data ?? null}
                currencyCode={CURRENCY_CODE}
            />
        </Screen>
    );
}

const styles = StyleSheet.create(theme => ({
    flex: {
        flex: 1,
    },
    head: {
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.sm,
        paddingBottom: theme.spacing.md,
    },
    loading: {
        paddingHorizontal: theme.spacing.md,
    },
    state: {
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing['3xl'],
    },
    footer: {
        alignItems: 'center',
        paddingVertical: theme.spacing.lg,
    },
}));
