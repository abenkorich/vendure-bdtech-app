import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Divider} from '@/components/ui';

/**
 * Spec sheet.
 *
 * This is an electronics catalogue: the specification table is the product, not
 * a footnote to it. So it is rendered as a real two-column table — label start,
 * value end, hairline between rows, tabular figures on the values — rather than
 * as prose or pill-shaped chips. A row of chips cannot be compared down a
 * column, which is the only thing anyone does with these numbers.
 *
 * Values are tabular even when they are not purely numeric ("5 V", "±1%"),
 * because the digits inside them are what the eye is scanning.
 */
export interface SpecRow {
    label: string;
    value: string;
}

export interface SpecSheetProps {
    title: string;
    rows: readonly SpecRow[];
}

export function SpecSheet({title, rows}: SpecSheetProps) {
    if (rows.length === 0) return null;

    return (
        <View style={styles.root}>
            <Text variant="heading" style={styles.title}>
                {title}
            </Text>

            <View style={styles.table}>
                {rows.map((row, index) => (
                    <View key={`${row.label}-${index}`}>
                        {index > 0 ? <Divider /> : null}
                        <View style={styles.row}>
                            <Text variant="caption" color="textMuted" style={styles.label} numberOfLines={2}>
                                {row.label}
                            </Text>
                            <Text
                                variant="caption"
                                tabular
                                align="end"
                                style={styles.value}
                                numberOfLines={3}
                            >
                                {row.value}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.lg,
        gap: theme.spacing.md,
    },
    title: {},
    table: {
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        // Elevation as tint: the table reads as a raised instrument panel
        // without a shadow, which would muddy on the dark surface.
        backgroundColor: theme.colors.surface,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.lg,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        minHeight: 40,
    },
    // 2fr / 3fr rather than 50/50: labels are short and predictable, values are
    // where the variance is.
    label: {flex: 2},
    value: {flex: 3},
}));
