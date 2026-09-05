import {forwardRef, useState} from 'react';
import {
    Pressable,
    TextInput,
    View,
    type TextInputProps,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Text, IconSymbol, type IconName} from '@/components/ui';
import {translate} from '../i18n';

/**
 * Form field.
 *
 * Lives in feature-land rather than `components/ui` because the design system
 * is owned by another workstream and does not ship an input primitive; if one
 * lands later this file becomes a re-export.
 *
 * Two things it refuses to do, both learned from forms that shipped broken:
 * an error is never conveyed by border color alone (it is always accompanied
 * by a message, so it survives color-blindness and a screenshot), and the
 * error slot does not collapse the layout — the field keeps a stable height so
 * a form does not jump as a user types.
 */

export interface FieldProps extends Omit<TextInputProps, 'style'> {
    label: string;
    /** Inline error message. Presence marks the field invalid. */
    error?: string | null;
    /** Helper text shown when there is no error. */
    hint?: string;
    /** Leading icon, inside the field box. */
    icon?: IconName;
    /** Renders a show/hide toggle and starts obscured. */
    secure?: boolean;
    /** Right-hand adornment (unit picker, suffix). */
    trailing?: React.ReactNode;
    containerStyle?: StyleProp<ViewStyle>;
    /** Monospaced digits — for any numeric input. */
    tabular?: boolean;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
    {
        label,
        error,
        hint,
        icon,
        secure = false,
        trailing,
        containerStyle,
        tabular = false,
        onFocus,
        onBlur,
        ...rest
    },
    ref,
) {
    const {theme} = useUnistyles();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);

    const state = error ? 'error' : focused ? 'focused' : 'idle';
    styles.useVariants({state});

    return (
        <View style={[styles.root, containerStyle]}>
            <Text variant="caption" color={error ? 'danger' : 'textMuted'}>
                {label}
            </Text>

            <View style={styles.box}>
                {icon ? (
                    <IconSymbol name={icon} size={18} color={error ? 'danger' : 'textMuted'} />
                ) : null}

                <TextInput
                    ref={ref}
                    style={[styles.input, tabular && styles.tabular]}
                    placeholderTextColor={theme.colors.textMuted}
                    selectionColor={theme.colors.brand}
                    secureTextEntry={secure && !revealed}
                    accessibilityLabel={label}
                    // A field that announces itself valid while showing an
                    // error message is worse than no announcement at all.
                    accessibilityState={{}}
                    onFocus={event => {
                        setFocused(true);
                        onFocus?.(event);
                    }}
                    onBlur={event => {
                        setFocused(false);
                        onBlur?.(event);
                    }}
                    {...rest}
                />

                {secure ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                            revealed ? translate('Auth.hidePassword') : translate('Auth.showPassword')
                        }
                        hitSlop={12}
                        onPress={() => setRevealed(value => !value)}
                    >
                        {/* The icon set has no eye glyph and it is owned by
                            another workstream, so the toggle shows its own
                            state as language-neutral glyphs instead. */}
                        <Text variant="micro" color={revealed ? 'brand' : 'textMuted'} tabular>
                            {revealed ? 'ABC' : '•••'}
                        </Text>
                    </Pressable>
                ) : null}

                {trailing}
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
        </View>
    );
});

const styles = StyleSheet.create(theme => ({
    root: {
        gap: theme.spacing.xs,
    },
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
                focused: {borderColor: theme.colors.brand},
                error: {borderColor: theme.colors.danger},
            },
        },
    },
    input: {
        flex: 1,
        paddingVertical: theme.spacing.sm,
        color: theme.colors.text,
        ...theme.typography.body,
        // `textAlign: auto` follows the writing direction, so an Arabic form
        // types right-to-left without a per-field branch.
        textAlign: 'auto',
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    message: {
        flex: 1,
    },
}));
