import {forwardRef} from 'react';
import {TextInput, View, type TextInputProps} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text} from '@/components/ui';

/**
 * Text field for cart and checkout forms.
 *
 * Lives in the commerce feature rather than `components/ui` because the design
 * system does not ship an input primitive; if one lands there this becomes a
 * re-export. Deliberately not a copy of any web component.
 *
 * `textAlign: 'left'` is never set: RN resolves the default from the layout
 * direction, so the field is right-aligned in Arabic for free. Padding uses
 * logical properties for the same reason.
 */

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    /** Validation message. Its presence also tints the border. */
    error?: string | null;
    /** Helper text under the field, hidden while an error is showing. */
    hint?: string;
    required?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
    {label, error, hint, required = false, ...rest},
    ref,
) {
    const {theme} = useUnistyles();
    styles.useVariants({invalid: Boolean(error)});

    return (
        <View style={styles.root}>
            {label ? (
                <Text variant="caption" color="textMuted">
                    {required ? `${label} *` : label}
                </Text>
            ) : null}

            <TextInput
                ref={ref}
                style={styles.input}
                placeholderTextColor={theme.colors.textMuted}
                selectionColor={theme.colors.brand}
                accessibilityLabel={label}
                {...rest}
            />

            {error ? (
                <Text variant="micro" color="danger">
                    {error}
                </Text>
            ) : hint ? (
                <Text variant="micro" color="textMuted">
                    {hint}
                </Text>
            ) : null}
        </View>
    );
});

const styles = StyleSheet.create(theme => ({
    root: {gap: theme.spacing.xs},
    input: {
        ...theme.typography.body,
        color: theme.colors.text,
        backgroundColor: theme.colors.surfaceElevated,
        borderRadius: theme.radius.md,
        borderWidth: theme.elevation.card.borderWidth,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        minHeight: 48,
        variants: {
            invalid: {
                true: {borderColor: theme.colors.danger},
                false: {borderColor: theme.colors.border},
            },
        },
    },
}));
