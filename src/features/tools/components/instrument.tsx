import {useMemo} from 'react';
import {Pressable, TextInput, View} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text} from '@/components/ui';

/**
 * Shared chrome for the six calculators.
 *
 * These read as lab instruments rather than forms: a value and its unit sit on
 * one line, every number is tabular so a digit does not shift as it updates,
 * and derived readouts are visually distinct from what the user typed. There is
 * no submit button anywhere — the readout tracks the input.
 */

/* ------------------------------------------------------------- value field */

export interface UnitOption {
    value: string;
    label: string;
}

export interface ValueFieldProps {
    label: string;
    value: string;
    onChangeValue: (next: string) => void;
    placeholder?: string;
    units?: readonly UnitOption[];
    unit?: string;
    onChangeUnit?: (next: string) => void;
    /** Marks the field as an engine-derived readout: read-only, muted. */
    computed?: boolean;
    /** Value shown when `computed`. */
    computedValue?: string;
}

export function ValueField({
    label,
    value,
    onChangeValue,
    placeholder,
    units,
    unit,
    onChangeUnit,
    computed = false,
    computedValue,
}: ValueFieldProps) {
    const {theme} = useUnistyles();

    return (
        <View style={styles.field}>
            <Text variant="micro" color="textMuted" uppercase>
                {label}
            </Text>
            <View style={styles.fieldRow}>
                {computed ? (
                    <View style={[styles.input, styles.inputComputed]}>
                        <Text variant="bodyStrong" color="brand" tabular numberOfLines={1}>
                            {computedValue ?? '—'}
                        </Text>
                    </View>
                ) : (
                    <TextInput
                        style={styles.input}
                        value={value}
                        onChangeText={onChangeValue}
                        placeholder={placeholder}
                        placeholderTextColor={theme.colors.textMuted}
                        keyboardType="decimal-pad"
                        inputMode="decimal"
                        accessibilityLabel={label}
                        // `textAlign: left` rather than a logical property:
                        // these are numbers, and a number reads left-to-right
                        // even in Arabic. The *label* above follows direction.
                        textAlign="left"
                    />
                )}

                {units && unit && onChangeUnit ? (
                    <UnitPicker options={units} value={unit} onChange={onChangeUnit} label={label} />
                ) : null}
            </View>
        </View>
    );
}

/* ------------------------------------------------------------ unit picker */

export interface UnitPickerProps {
    options: readonly UnitOption[];
    value: string;
    onChange: (next: string) => void;
    label?: string;
}

/**
 * Inline unit picker. A row of small pressables rather than a native picker
 * sheet: there are at most four units and the conversion is the interesting
 * part, so hiding it behind a modal would break the live-readout feel.
 */
export function UnitPicker({options, value, onChange, label}: UnitPickerProps) {
    return (
        <View style={styles.units} accessibilityRole="radiogroup" accessibilityLabel={label}>
            {options.map(option => {
                const selected = option.value === value;
                return (
                    <Pressable
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityState={{selected}}
                        onPress={() => onChange(option.value)}
                        style={[styles.unit, selected && styles.unitSelected]}
                        hitSlop={6}
                    >
                        <Text
                            variant="micro"
                            color={selected ? 'onBrand' : 'textMuted'}
                            tabular
                            numberOfLines={1}
                        >
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

/* ------------------------------------------------------------ readout grid */

export interface ReadoutRow {
    label: string;
    value: string;
    /** Emphasises the row as the headline answer. */
    primary?: boolean;
    /** Marks a value the user supplied rather than one that was derived. */
    muted?: boolean;
}

/**
 * The instrument readout: a tight two-column grid of label and value.
 *
 * Values are right-aligned against a shared edge (physically, not logically) so
 * decimal points line up into a column — the reason the readouts are legible at
 * a glance, and the reason this does not use `end` alignment even in Arabic.
 */
export function Readout({title, rows}: {title?: string; rows: readonly ReadoutRow[]}) {
    return (
        <View style={styles.readout}>
            {title ? (
                <Text variant="micro" color="textMuted" uppercase>
                    {title}
                </Text>
            ) : null}
            <View style={styles.readoutGrid}>
                {rows.map((row, index) => (
                    <View
                        key={row.label}
                        style={[styles.readoutRow, index > 0 && styles.readoutRowDivided]}
                    >
                        <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.readoutLabel}>
                            {row.label}
                        </Text>
                        <Text
                            variant={row.primary ? 'heading' : 'bodyStrong'}
                            color={row.muted ? 'textMuted' : row.primary ? 'brand' : 'text'}
                            tabular
                            numberOfLines={1}
                            style={styles.readoutValue}
                        >
                            {row.value}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

/* ---------------------------------------------------------------- formulas */

export function Formulas({title, formulas}: {title: string; formulas: readonly string[]}) {
    if (formulas.length === 0) return null;

    return (
        <View style={styles.formulas}>
            <Text variant="micro" color="textMuted" uppercase>
                {title}
            </Text>
            {formulas.map(formula => (
                <Text key={formula} variant="caption" color="text" tabular style={styles.formula}>
                    {formula}
                </Text>
            ))}
        </View>
    );
}

/* -------------------------------------------------------------- hint/error */

export function Hint({children}: {children: string}) {
    return (
        <Text variant="caption" color="textMuted" style={styles.hint}>
            {children}
        </Text>
    );
}

export function CalcError({children}: {children: string}) {
    return (
        <View style={styles.error} accessibilityRole="alert">
            <Text variant="caption" color="danger">
                {children}
            </Text>
        </View>
    );
}

/* --------------------------------------------------------------- education */

export function Education({title, body}: {title: string; body: string}) {
    return (
        <View style={styles.education}>
            <Text variant="heading">{title}</Text>
            <Text variant="body" color="textMuted">
                {body}
            </Text>
        </View>
    );
}

/** Section wrapper: an elevated panel, tint + hairline (never a shadow). */
export function Panel({title, children}: {title?: string; children: React.ReactNode}) {
    return (
        <View style={styles.panel}>
            {title ? (
                <Text variant="micro" color="textMuted" uppercase>
                    {title}
                </Text>
            ) : null}
            {children}
        </View>
    );
}

/** Turns a units record from an engine into picker options via the catalog. */
export function useUnitOptions(
    units: Record<string, number>,
    t: (key: string) => string,
): UnitOption[] {
    return useMemo(
        () => Object.keys(units).map(key => ({value: key, label: t(`units.${key}`)})),
        [units, t],
    );
}

const styles = StyleSheet.create(theme => ({
    field: {gap: theme.spacing.xs},
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    input: {
        flex: 1,
        minHeight: 44,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        color: theme.colors.text,
        justifyContent: 'center',
        fontSize: theme.typography.bodyStrong.fontSize,
        fontWeight: theme.typography.bodyStrong.fontWeight,
        fontVariant: ['tabular-nums'],
    },
    inputComputed: {
        backgroundColor: theme.colors.surfaceElevated,
        borderStyle: 'dashed',
    },
    units: {
        flexDirection: 'row',
        gap: theme.spacing.xs,
        padding: theme.spacing.xs,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
    },
    unit: {
        minWidth: 36,
        minHeight: 32,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.sm,
    },
    unitSelected: {backgroundColor: theme.colors.brand},
    readout: {gap: theme.spacing.sm},
    readoutGrid: {
        borderRadius: theme.radius.lg,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        overflow: 'hidden',
    },
    readoutRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        minHeight: 48,
    },
    readoutRowDivided: {
        borderTopWidth: theme.elevation.card.borderWidth,
        borderTopColor: theme.colors.border,
    },
    readoutLabel: {flexShrink: 1},
    readoutValue: {textAlign: 'right'},
    formulas: {gap: theme.spacing.xs},
    formula: {
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceElevated,
        textAlign: 'left',
    },
    hint: {paddingBottom: theme.spacing.xs},
    error: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.danger,
        backgroundColor: theme.colors.surfaceElevated,
    },
    education: {
        gap: theme.spacing.sm,
        paddingTop: theme.spacing.lg,
        borderTopWidth: theme.elevation.card.borderWidth,
        borderTopColor: theme.colors.border,
    },
    panel: {gap: theme.spacing.md},
}));
