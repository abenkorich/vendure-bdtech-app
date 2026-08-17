import {KeyboardAvoidingView, Platform, Pressable, ScrollView, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {useRouter} from 'expo-router';
import {Text, IconSymbol, Divider, type IconName} from '@/components/ui';
import {ServerUnreachableError} from '@/lib/vendure/api';
import {translate} from '../i18n';

/**
 * Small shared chrome for the account/auth/blog/tools screens.
 */

/* ------------------------------------------------------------------ header */

export interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    /** Shows a back chevron. Defaults to true on stack screens. */
    onBack?: () => void;
    /** Trailing control, e.g. an "Add" button. */
    trailing?: React.ReactNode;
}

export function ScreenHeader({title, subtitle, onBack, trailing}: ScreenHeaderProps) {
    return (
        <View style={styles.header}>
            <View style={styles.headerRow}>
                {onBack ? (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={translate('Account.backToOrders')}
                        hitSlop={12}
                        onPress={onBack}
                        style={styles.backButton}
                    >
                        {/* chevronBack mirrors itself in RTL, see IconSymbol. */}
                        <IconSymbol name="chevronBack" size={22} />
                    </Pressable>
                ) : null}
                <Text variant="title" style={styles.headerTitle} numberOfLines={1}>
                    {title}
                </Text>
                {trailing}
            </View>
            {subtitle ? (
                <Text variant="caption" color="textMuted">
                    {subtitle}
                </Text>
            ) : null}
        </View>
    );
}

/** A header wired to `router.back()`, for stack screens. */
export function BackHeader(props: Omit<ScreenHeaderProps, 'onBack'>) {
    const router = useRouter();
    return <ScreenHeader {...props} onBack={() => router.back()} />;
}

/* ------------------------------------------------------------- form layout */

/**
 * Keyboard-aware scrolling form body.
 *
 * `KeyboardAvoidingView` with `padding` on iOS and `height` on Android is the
 * combination that actually keeps a submit button visible on both; `behavior`
 * left unset means the keyboard covers the last field on iOS, which is exactly
 * where the password field tends to be.
 */
export function FormBody({children}: {children: React.ReactNode}) {
    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
            >
                {children}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

/* ------------------------------------------------------------ error banner */

/**
 * Server-error banner.
 *
 * Distinguishing *unreachable* from *rejected* is the whole point: a user who
 * mistypes a password and a user on a dead connection need different next
 * actions, and "Something went wrong" tells neither of them anything.
 */
export function ErrorBanner({error}: {error: unknown}) {
    if (!error) return null;

    const unreachable = error instanceof ServerUnreachableError;
    const message = unreachable
        ? translate('Errors.serverUnreachableBody')
        : error instanceof Error && error.message
          ? error.message
          : translate('Errors.unexpectedError');

    return (
        <View style={styles.banner} accessibilityRole="alert">
            <IconSymbol name={unreachable ? 'offline' : 'error'} size={18} color="danger" />
            <View style={styles.bannerText}>
                <Text variant="bodyStrong" color="danger">
                    {unreachable
                        ? translate('Errors.serverUnreachableTitle')
                        : translate('Errors.somethingWentWrong')}
                </Text>
                <Text variant="caption" color="textMuted">
                    {message}
                </Text>
            </View>
        </View>
    );
}

/** Positive counterpart, for "profile updated" style confirmations. */
export function SuccessBanner({message}: {message: string}) {
    return (
        <View style={[styles.banner, styles.bannerSuccess]} accessibilityRole="alert">
            <IconSymbol name="checkCircle" size={18} color="success" />
            <Text variant="caption" color="text" style={styles.bannerText}>
                {message}
            </Text>
        </View>
    );
}

/* ---------------------------------------------------------------- list row */

export interface LinkRowProps {
    icon: IconName;
    title: string;
    subtitle?: string;
    value?: string;
    onPress: () => void;
    tone?: 'default' | 'danger';
}

export function LinkRow({icon, title, subtitle, value, onPress, tone = 'default'}: LinkRowProps) {
    return (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
        >
            <View style={styles.rowIcon}>
                <IconSymbol name={icon} size={18} color={tone === 'danger' ? 'danger' : 'brand'} />
            </View>
            <View style={styles.flex}>
                <Text variant="bodyStrong" color={tone === 'danger' ? 'danger' : 'text'}>
                    {title}
                </Text>
                {subtitle ? (
                    <Text variant="caption" color="textMuted">
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            {value ? (
                <Text variant="caption" color="textMuted" tabular>
                    {value}
                </Text>
            ) : null}
            <IconSymbol name="chevronForward" size={16} color="textMuted" />
        </Pressable>
    );
}

export function RowGroup({children}: {children: React.ReactNode}) {
    const items = Array.isArray(children) ? children.filter(Boolean) : [children];
    return (
        <View style={styles.group}>
            {items.map((child, index) => (
                // eslint-disable-next-line react/no-array-index-key -- static rows
                <View key={index}>
                    {index > 0 ? <Divider inset="lg" /> : null}
                    {child}
                </View>
            ))}
        </View>
    );
}

/* --------------------------------------------------------------- segmented */

export interface SegmentedProps<T extends string> {
    options: readonly {value: T; label: string}[];
    value: T;
    onChange: (value: T) => void;
    /** Accessible label for the group. */
    label?: string;
}

/**
 * Segmented control — mode switches on the calculators, band count, tabs.
 *
 * A plain row of pressables rather than the platform control: the iOS
 * `SegmentedControl` is a native spec component, which Unistyles' Babel plugin
 * cannot process, and it would freeze on whichever theme was active first (the
 * SafeAreaView trap in AGENTS.md, same cause).
 */
export function Segmented<T extends string>({options, value, onChange, label}: SegmentedProps<T>) {
    return (
        <View style={styles.segmented} accessibilityRole="tablist" accessibilityLabel={label}>
            {options.map(option => {
                const selected = option.value === value;
                return (
                    <Pressable
                        key={option.value}
                        accessibilityRole="tab"
                        accessibilityState={{selected}}
                        onPress={() => onChange(option.value)}
                        style={[styles.segment, selected && styles.segmentSelected]}
                    >
                        <Text
                            variant="caption"
                            color={selected ? 'onBrand' : 'textMuted'}
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

const styles = StyleSheet.create(theme => ({
    flex: {flex: 1},
    header: {
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.lg,
        gap: theme.spacing.xs,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
    },
    headerTitle: {flex: 1},
    backButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginStart: -theme.spacing.sm,
    },
    formContent: {
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing['3xl'],
        gap: theme.spacing.lg,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.danger,
    },
    bannerSuccess: {
        borderColor: theme.colors.success,
    },
    bannerText: {flex: 1, gap: theme.spacing.xs},
    group: {
        borderRadius: theme.radius.lg,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
        minHeight: 56,
    },
    rowPressed: {
        backgroundColor: theme.colors.surfaceElevated,
    },
    rowIcon: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.brandMuted,
    },
    segmented: {
        flexDirection: 'row',
        padding: theme.spacing.xs,
        gap: theme.spacing.xs,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceElevated,
        borderWidth: theme.elevation.card.borderWidth,
        borderColor: theme.colors.border,
    },
    segment: {
        flex: 1,
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.sm,
    },
    segmentSelected: {
        backgroundColor: theme.colors.brand,
    },
}));
