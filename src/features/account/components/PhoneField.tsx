import {useState} from 'react';
import {Pressable, ScrollView, TextInput, View} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text, IconSymbol, Sheet, Divider} from '@/components/ui';
import {
    CALLING_COUNTRIES,
    formatNational,
    toE164,
    type CallingCountry,
} from '@/lib/phone-number';

/**
 * Mobile number field: a country selector, then the number itself.
 *
 * The value handed out is always E.164 (`+213550000000`) or an empty string,
 * so nothing downstream has to know which country was picked or whether the
 * customer typed a trunk zero. The value shown is the national form, grouped
 * the way that country writes it, because a customer proof-reads their own
 * number in the shape they know it — `0550 12 34 56`, not `+213550123456`.
 *
 * The selector is a sheet rather than a wheel for the same reason
 * `checkout/Picker` is: Unistyles' Babel plugin cannot process the platform
 * picker, so it would be stuck on whichever theme rendered first.
 *
 * It is built next to `Field` rather than on top of it because the country
 * chip has to sit *inside* the input box, sharing its border and its focus
 * state — a leading slot `Field` does not have.
 */

export interface PhoneFieldProps {
    label: string;
    /** E.164, or empty. */
    value: string;
    country: CallingCountry;
    onChange: (e164: string) => void;
    onCountryChange: (country: CallingCountry) => void;
    onBlur?: () => void;
    error?: string | null;
    hint?: string;
    /** Sheet title and its accessible name. */
    selectorLabel: string;
    searchPlaceholder: string;
    noMatchMessage: string;
    editable?: boolean;
    returnKeyType?: 'next' | 'go' | 'done';
    onSubmitEditing?: () => void;
}

export function PhoneField({
    label,
    value,
    country,
    onChange,
    onCountryChange,
    onBlur,
    error,
    hint,
    selectorLabel,
    searchPlaceholder,
    noMatchMessage,
    editable = true,
    returnKeyType,
    onSubmitEditing,
}: PhoneFieldProps) {
    const {theme} = useUnistyles();
    const [focused, setFocused] = useState(false);
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');

    styles.useVariants({state: error ? 'error' : focused ? 'focused' : 'idle'});

    const folded = term.trim().toLocaleLowerCase();
    const filtered = folded
        ? CALLING_COUNTRIES.filter(
              entry =>
                  entry.name.toLocaleLowerCase().includes(folded) ||
                  entry.iso.toLocaleLowerCase().includes(folded) ||
                  entry.calling.includes(folded.replace('+', '')),
          )
        : CALLING_COUNTRIES;

    return (
        <View style={styles.root}>
            <Text variant="caption" color={error ? 'danger' : 'textMuted'}>
                {label}
            </Text>

            <View style={styles.box}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${selectorLabel}: ${country.name} +${country.calling}`}
                    disabled={!editable}
                    onPress={() => {
                        setTerm('');
                        setOpen(true);
                    }}
                    style={styles.chip}
                >
                    <Text variant="body">{country.flag}</Text>
                    <Text variant="body" color="textMuted" tabular>
                        {`+${country.calling}`}
                    </Text>
                    <IconSymbol name="chevronDown" size={14} color="textMuted" />
                </Pressable>

                {/* A rule, not a gap: without it the chip and the number read
                    as one run of characters and the country looks typed. */}
                <View style={styles.chipRule} />

                <TextInput
                    style={styles.input}
                    value={formatNational(country, value)}
                    onChangeText={next => onChange(toE164(country, next))}
                    placeholder={country.example}
                    placeholderTextColor={theme.colors.textMuted}
                    selectionColor={theme.colors.brand}
                    keyboardType="phone-pad"
                    inputMode="tel"
                    autoComplete="tel-national"
                    textContentType="telephoneNumber"
                    accessibilityLabel={label}
                    editable={editable}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        setFocused(false);
                        onBlur?.();
                    }}
                />
            </View>

            {error ? (
                <View style={styles.messageRow}>
                    <IconSymbol name="error" size={13} color="danger" />
                    <Text variant="micro" color="danger" style={styles.message}>
                        {error}
                    </Text>
                </View>
            ) : hint ? (
                <Text variant="micro" color="textMuted">
                    {hint}
                </Text>
            ) : null}

            <Sheet open={open} onClose={() => setOpen(false)} title={selectorLabel} height={0.7}>
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
                        autoCapitalize="none"
                        accessibilityLabel={searchPlaceholder}
                    />
                </View>

                <ScrollView
                    style={styles.list}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.listContent}
                >
                    {filtered.length === 0 ? (
                        <Text variant="caption" color="textMuted" style={styles.emptyText}>
                            {noMatchMessage}
                        </Text>
                    ) : (
                        filtered.map((entry, index) => (
                            <View key={entry.iso}>
                                {index > 0 ? <Divider /> : null}
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{selected: entry.iso === country.iso}}
                                    onPress={() => {
                                        // The digits already typed belong to
                                        // the old plan, so the number is
                                        // re-read under the new one rather
                                        // than silently keeping a code that
                                        // no longer applies.
                                        onCountryChange(entry);
                                        onChange(toE164(entry, formatNational(country, value)));
                                        setOpen(false);
                                    }}
                                    style={({pressed}) => [
                                        styles.option,
                                        pressed && styles.optionPressed,
                                    ]}
                                >
                                    <Text variant="body">{entry.flag}</Text>
                                    <Text variant="body" style={styles.optionName} numberOfLines={1}>
                                        {entry.name}
                                    </Text>
                                    <Text variant="caption" color="textMuted" tabular>
                                        {`+${entry.calling}`}
                                    </Text>
                                    {entry.iso === country.iso ? (
                                        <IconSymbol name="check" size={16} color="brand" />
                                    ) : null}
                                </Pressable>
                            </View>
                        ))
                    )}
                </ScrollView>
            </Sheet>
        </View>
    );
}

const styles = StyleSheet.create(theme => ({
    root: {
        gap: theme.spacing.xs,
    },
    box: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        paddingEnd: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        variants: {
            state: {
                idle: {borderColor: theme.colors.border},
                focused: {borderColor: theme.colors.brand},
                error: {borderColor: theme.colors.danger},
            },
        },
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        alignSelf: 'stretch',
        paddingHorizontal: theme.spacing.md,
    },
    chipRule: {
        width: theme.elevation.card.borderWidth,
        alignSelf: 'stretch',
        marginVertical: theme.spacing.sm,
        backgroundColor: theme.colors.border,
    },
    input: {
        flex: 1,
        paddingVertical: theme.spacing.sm,
        paddingStart: theme.spacing.md,
        color: theme.colors.text,
        ...theme.typography.body,
        fontVariant: ['tabular-nums'],
        textAlign: 'auto',
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    message: {
        flex: 1,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: 44,
        paddingHorizontal: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    searchInput: {
        flex: 1,
        paddingVertical: theme.spacing.sm,
        color: theme.colors.text,
        ...theme.typography.body,
        textAlign: 'auto',
    },
    list: {
        flexGrow: 0,
    },
    listContent: {
        paddingBottom: theme.spacing.md,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
    },
    optionPressed: {
        opacity: 0.6,
    },
    optionName: {
        flex: 1,
    },
    emptyText: {
        paddingVertical: theme.spacing.lg,
        textAlign: 'center',
    },
}));
