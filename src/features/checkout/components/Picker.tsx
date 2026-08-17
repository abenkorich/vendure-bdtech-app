import {useMemo, useState} from 'react';
import {Pressable, ScrollView, TextInput, View} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text, IconSymbol, Sheet, Divider} from '@/components/ui';

/**
 * Searchable picker.
 *
 * Written because the two lists this checkout depends on are *long* and the
 * platform has no answer that works here: 58 wilayas, up to 60 communes inside
 * one of them, and 24 Yalidine centres in Algiers alone. A native picker wheel
 * cannot be searched, and Unistyles' Babel plugin cannot process it anyway
 * (the SafeAreaView trap in AGENTS.md, same cause), so it would also be stuck
 * on whichever theme rendered first.
 *
 * The search box only appears past a threshold: for a five-item list a filter
 * field is a keyboard in the way of the answer.
 */

export interface PickerOption {
    value: string;
    label: string;
    /** Second line — a centre's street address, a commune's wilaya. */
    detail?: string;
}

export interface PickerProps {
    label: string;
    placeholder: string;
    value: string | null;
    options: readonly PickerOption[];
    onChange: (value: string) => void;
    disabled?: boolean;
    loading?: boolean;
    error?: string | null;
    /** Empty-list copy, e.g. "No centres serve this wilaya". */
    emptyMessage: string;
    searchPlaceholder: string;
    noMatchMessage: string;
}

const SEARCH_THRESHOLD = 8;

export function Picker({
    label,
    placeholder,
    value,
    options,
    onChange,
    disabled = false,
    loading = false,
    error,
    emptyMessage,
    searchPlaceholder,
    noMatchMessage,
}: PickerProps) {
    const {theme} = useUnistyles();
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');

    const selected = options.find(option => option.value === value) ?? null;

    const filtered = useMemo(() => {
        const folded = term.trim().toLocaleLowerCase();
        if (!folded) return options;
        return options.filter(
            option =>
                option.label.toLocaleLowerCase().includes(folded) ||
                option.detail?.toLocaleLowerCase().includes(folded),
        );
    }, [options, term]);

    const isDisabled = disabled || loading;

    styles.useVariants({state: error ? 'error' : isDisabled ? 'disabled' : 'idle'});

    return (
        <View style={styles.root}>
            <Text variant="caption" color={error ? 'danger' : 'textMuted'}>
                {label}
            </Text>

            <Pressable
                accessibilityRole="button"
                accessibilityState={{disabled: isDisabled, expanded: open}}
                accessibilityLabel={label}
                accessibilityValue={{text: selected?.label ?? placeholder}}
                disabled={isDisabled}
                onPress={() => {
                    setTerm('');
                    setOpen(true);
                }}
                style={styles.box}
            >
                <Text
                    variant="body"
                    color={selected ? 'text' : 'textMuted'}
                    numberOfLines={1}
                    style={styles.boxLabel}
                >
                    {loading ? '…' : (selected?.label ?? placeholder)}
                </Text>
                <IconSymbol name="chevronDown" size={16} color="textMuted" />
            </Pressable>

            {error ? (
                <View style={styles.messageRow}>
                    <IconSymbol name="error" size={13} color="danger" />
                    <Text variant="micro" color="danger" style={styles.message}>
                        {error}
                    </Text>
                </View>
            ) : null}

            <Sheet open={open} onClose={() => setOpen(false)} title={label} height={0.75}>
                {options.length > SEARCH_THRESHOLD ? (
                    <View style={styles.searchBox}>
                        <IconSymbol name="search" size={16} color="textMuted" />
                        <TextInput
                            style={styles.searchInput}
                            value={term}
                            onChangeText={setTerm}
                            placeholder={searchPlaceholder}
                            placeholderTextColor={theme.colors.textMuted}
                            selectionColor={theme.colors.brand}
                            autoCorrect={false}
                            accessibilityLabel={searchPlaceholder}
                        />
                    </View>
                ) : null}

                <ScrollView
                    style={styles.list}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.listContent}
                >
                    {options.length === 0 ? (
                        <Text variant="caption" color="textMuted" style={styles.emptyText}>
                            {emptyMessage}
                        </Text>
                    ) : filtered.length === 0 ? (
                        <Text variant="caption" color="textMuted" style={styles.emptyText}>
                            {noMatchMessage}
                        </Text>
                    ) : (
                        filtered.map((option, index) => {
                            const isSelected = option.value === value;
                            return (
                                <View key={option.value}>
                                    {index > 0 ? <Divider /> : null}
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityState={{selected: isSelected}}
                                        onPress={() => {
                                            onChange(option.value);
                                            setOpen(false);
                                        }}
                                        style={({pressed}) => [
                                            styles.option,
                                            pressed && styles.optionPressed,
                                        ]}
                                    >
                                        <View style={styles.optionText}>
                                            <Text
                                                variant={isSelected ? 'bodyStrong' : 'body'}
                                                color={isSelected ? 'brand' : 'text'}
                                            >
                                                {option.label}
                                            </Text>
                                            {option.detail ? (
                                                <Text
                                                    variant="micro"
                                                    color="textMuted"
                                                    numberOfLines={2}
                                                >
                                                    {option.detail}
                                                </Text>
                                            ) : null}
                                        </View>
                                        {isSelected ? (
                                            <IconSymbol name="check" size={18} color="brand" />
                                        ) : null}
                                    </Pressable>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            </Sheet>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.xs},
    box: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: 48,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        variants: {
            state: {
                idle: {borderColor: theme.colors.border},
                error: {borderColor: theme.colors.danger},
                disabled: {borderColor: theme.colors.border, opacity: 0.5},
            },
        },
    },
    boxLabel: {flex: 1},
    messageRow: {flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs},
    message: {flex: 1},
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        marginHorizontal: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        minHeight: 44,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    searchInput: {
        flex: 1,
        ...theme.typography.body,
        color: theme.colors.text,
        paddingVertical: theme.spacing.sm,
        textAlign: 'auto',
    },
    list: {maxHeight: 480},
    listContent: {paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl},
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        minHeight: 52,
    },
    optionPressed: {opacity: 0.6},
    optionText: {flex: 1, gap: theme.spacing.xs},
    emptyText: {paddingVertical: theme.spacing.xl},
}));
