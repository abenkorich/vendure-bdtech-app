import {forwardRef} from 'react';
import {Pressable, TextInput, View, type TextInputProps} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {IconSymbol} from '@/components/ui';

/**
 * The search field.
 *
 * Uncontrolled-feeling by construction: `value` is plain React state owned by
 * the screen and updated on every keystroke, and only the *query key* derived
 * from it is debounced. Nothing in this component waits on a request, so the
 * caret never stalls.
 *
 * RTL: the icon and the clear button use `start`/`end` gaps in a flex row, so
 * in Arabic the magnifier moves to the right edge and the clear button to the
 * left without a branch. `textAlign: 'auto'` lets the platform place the caret
 * according to the text's own direction, which matters when an Arabic UI is
 * used to type a Latin part number like "ESP32".
 */

export interface SearchFieldProps extends Omit<TextInputProps, 'style' | 'value'> {
    value: string;
    onChangeText: (text: string) => void;
    onClear: () => void;
    placeholder: string;
    /** Accessible label for the clear button. */
    clearLabel: string;
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
    {value, onChangeText, onClear, placeholder, clearLabel, ...rest},
    ref,
) {
    const {theme} = useUnistyles();

    return (
        <View style={styles.field}>
            <IconSymbol name="search" size={18} color="textMuted" />

            <TextInput
                ref={ref}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                // "search" rather than "done": the key cap should say what it
                // does, and on iOS it also dismisses the keyboard on submit.
                returnKeyType="search"
                // A part number is not a sentence and is often mixed-case
                // ("ESP32-WROOM"); autocapitalise would fight the user.
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                clearButtonMode="never"
                accessibilityRole="search"
                accessibilityLabel={placeholder}
                {...rest}
            />

            {value.length > 0 ? (
                <Pressable
                    onPress={onClear}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={clearLabel}
                    style={styles.clear}
                >
                    <IconSymbol name="close" size={14} color="textMuted" />
                </Pressable>
            ) : null}
        </View>
    );
});

const styles = StyleSheet.create(theme => ({
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        height: 44,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    input: {
        flex: 1,
        ...theme.typography.body,
        color: theme.colors.text,
        // Android gives TextInput its own vertical padding, which makes the
        // text sit low in a fixed-height row.
        paddingVertical: 0,
        textAlign: 'auto',
    },
    clear: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        backgroundColor: theme.colors.border,
    },
}));
