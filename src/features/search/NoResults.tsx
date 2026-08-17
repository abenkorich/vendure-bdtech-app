import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Button} from '@/components/ui';
import {Chip} from './Chip';
import {suggestionsFor} from './filter-state';
import {useTranslations} from './i18n';

/**
 * The "no results" state.
 *
 * Deliberately not an `EmptyState` shrug: this screen is used by someone who
 * knows what they want, so a dead end must offer a route out. Three of them,
 * in order of likelihood — drop the filters that may have hidden the match,
 * try a near-miss term, or start over.
 */

export interface NoResultsProps {
    term: string;
    /** Shows "clear filters" first when filters could be the reason. */
    hasFilters: boolean;
    onClearFilters: () => void;
    onSelectTerm: (term: string) => void;
    onClearQuery: () => void;
}

export function NoResults({
    term,
    hasFilters,
    onClearFilters,
    onSelectTerm,
    onClearQuery,
}: NoResultsProps) {
    const t = useTranslations('Search');
    const suggestions = suggestionsFor(term);

    return (
        <View style={styles.root}>
            <Text variant="heading" align="center">
                {t('noResultsFor', {query: term})}
            </Text>
            <Text variant="body" color="textMuted" align="center" style={styles.body}>
                {t('noResultsHint')}
            </Text>

            {hasFilters ? (
                <Button variant="secondary" onPress={onClearFilters} icon="filter">
                    {t('clearFilters')}
                </Button>
            ) : null}

            <View style={styles.suggestions}>
                <Text variant="caption" color="textMuted" uppercase align="center">
                    {t('suggestionsTitle')}
                </Text>
                <View style={styles.chipRow}>
                    {suggestions.map(suggestion => (
                        <Chip
                            key={suggestion}
                            label={suggestion}
                            onPress={() => onSelectTerm(suggestion)}
                        />
                    ))}
                </View>
            </View>

            <Button variant="ghost" onPress={onClearQuery}>
                {t('clearQuery')}
            </Button>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing['2xl'],
        paddingBottom: theme.spacing['3xl'],
    },
    body: {
        maxWidth: 320,
    },
    suggestions: {
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingTop: theme.spacing.md,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: theme.spacing.sm,
    },
}));
