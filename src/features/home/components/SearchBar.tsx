import {View, Pressable} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {router} from 'expo-router';
import {Text, IconSymbol} from '@/components/ui';
import {useTranslations} from '@/i18n';

/**
 * Home search entry point.
 *
 * A *button* dressed as a search field, not a real input. Typing happens on
 * the search screen, which owns the debounce, history and filter state; a
 * second live input here would duplicate all of it and then disagree with it.
 * Tapping navigates and focuses there.
 *
 * The camera button is the image-search affordance. Visual search is not
 * implemented on the backend yet (there is no such query on the Shop API), so
 * it explains itself rather than doing nothing: an inert icon reads as a bug,
 * while "coming soon" reads as a roadmap.
 */

export interface SearchBarProps {
    /** Rotating hint from the customizer's `search.popularTerms`. */
    placeholderTerm?: string;
    onImageSearch?: () => void;
}

export function SearchBar({placeholderTerm, onImageSearch}: SearchBarProps) {
    const t = useTranslations('Search');
    const tNav = useTranslations('Navigation');

    // "Search for arduino" reads better than a bare placeholder, and it also
    // advertises what this catalogue actually stocks.
    const placeholder = placeholderTerm
        ? t('searchForTerm', {term: placeholderTerm})
        : tNav('searchProducts');

    return (
        <View style={styles.root}>
            <Pressable
                accessibilityRole="search"
                accessibilityLabel={tNav('searchProducts')}
                onPress={() => router.push('/search')}
                style={styles.field}
            >
                <IconSymbol name="search" size={18} color="textMuted" />
                <Text variant="body" color="textMuted" numberOfLines={1} style={styles.placeholder}>
                    {placeholder}
                </Text>
            </Pressable>

            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('imageSearch')}
                onPress={onImageSearch}
                style={styles.camera}
                hitSlop={8}
            >
                <IconSymbol name="camera" size={20} color="brand" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
    },
    field: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        height: 44,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    placeholder: {
        flex: 1,
    },
    camera: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.brandMuted,
    },
}));
