import {ScrollView, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, IconSymbol} from '@/components/ui';
import {Chip} from './Chip';
import {SUGGESTED_TERMS} from './filter-state';
import {useTranslations} from './i18n';

/**
 * What the screen shows before anything has been typed.
 *
 * Never a blank panel: an empty search screen is indistinguishable from one
 * that failed to load, which is precisely the silent failure this project got
 * bitten by on the web. Recents when they exist, catalogue-shaped popular
 * terms when they do not.
 */

export interface SearchStartProps {
    recent: readonly string[];
    onSelectTerm: (term: string) => void;
    onRemoveRecent: (term: string) => void;
    onClearRecent: () => void;
}

export function SearchStart({
    recent,
    onSelectTerm,
    onRemoveRecent,
    onClearRecent,
}: SearchStartProps) {
    const t = useTranslations('Search');

    return (
        <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
        >
            {recent.length > 0 ? (
                <View style={styles.section}>
                    <View style={styles.sectionHead}>
                        <Text variant="caption" color="textMuted" uppercase>
                            {t('recent')}
                        </Text>
                        <Text
                            variant="caption"
                            color="brand"
                            onPress={onClearRecent}
                            accessibilityRole="button"
                            suppressHighlighting
                        >
                            {t('clearRecent')}
                        </Text>
                    </View>
                    <View style={styles.chipRow}>
                        {recent.map(term => (
                            <Chip
                                key={term}
                                label={term}
                                onPress={() => onSelectTerm(term)}
                                onRemove={() => onRemoveRecent(term)}
                                removeLabel={`${t('clearRecent')} ${term}`}
                            />
                        ))}
                    </View>
                </View>
            ) : null}

            <View style={styles.section}>
                <Text variant="caption" color="textMuted" uppercase>
                    {t('popular')}
                </Text>
                <View style={styles.chipRow}>
                    {SUGGESTED_TERMS.map(term => (
                        <Chip key={term} label={term} onPress={() => onSelectTerm(term)} />
                    ))}
                </View>
            </View>

            <View style={styles.hint}>
                <IconSymbol name="chip" size={22} color="textMuted" />
                <Text variant="bodyStrong" align="center">
                    {t('startTitle')}
                </Text>
                <Text variant="caption" color="textMuted" align="center" style={styles.hintBody}>
                    {t('startHint')}
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create(theme => ({
    content: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.xl,
    },
    section: {
        gap: theme.spacing.md,
    },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing.sm,
    },
    hint: {
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.xl,
    },
    hintBody: {
        maxWidth: 300,
    },
}));
