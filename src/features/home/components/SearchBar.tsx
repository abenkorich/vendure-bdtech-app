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
 * The camera button is the image-search affordance, and it sits *inside* the
 * pill on its trailing edge rather than beside it, so the field itself runs
 * the full width of the screen. Visual search is not implemented on the
 * backend yet (there is no such query on the Shop API), so it explains itself
 * rather than doing nothing: an inert icon reads as a bug, while "coming
 * soon" reads as a roadmap.
 *
 * The pill is a plain `View` and the two tap targets are siblings inside it.
 * Nesting the camera in the field's own `Pressable` would work on iOS and
 * hand Android an ambiguous target; two siblings have one owner each.
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
            <View style={styles.field}>
                <Pressable
                    accessibilityRole="search"
                    accessibilityLabel={tNav('searchProducts')}
                    onPress={() => router.push('/search')}
                    style={styles.query}
                >
                    <IconSymbol name="search" size={18} color="textMuted" />
                    <Text
                        variant="body"
                        color="textMuted"
                        numberOfLines={1}
                        style={styles.placeholder}
                    >
                        {placeholder}
                    </Text>
                </Pressable>

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('imageSearch')}
                    onPress={onImageSearch}
                    style={styles.camera}
                    hitSlop={6}
                >
                    <IconSymbol name="camera" size={20} color="brand" />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
    },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        // Trailing padding is the camera's inset, not the text's: the button
        // carries its own width and sits 4pt off the pill's edge.
        paddingStart: theme.spacing.md,
        paddingEnd: theme.spacing.xs,
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    query: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        // Stretched so the whole height of the pill opens search, not just
        // the line of text through the middle of it.
        alignSelf: 'stretch',
    },
    placeholder: {
        flex: 1,
        // Keeps the hint clear of the camera when it is long enough to run
        // under it.
        marginEnd: theme.spacing.sm,
    },
    camera: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.brandMuted,
    },
}));
