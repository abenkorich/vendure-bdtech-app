import {Pressable, ScrollView, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text} from '@/components/ui';
import {RESISTOR_COLORS, type ResistorColorId} from '@/lib/tools/resistor-color-code';

/**
 * The resistor body: real colored bands, tappable to change.
 *
 * Drawn with plain views rather than SVG. The shape is a rounded beige body,
 * two lead wires and N colored stripes, all of which are rectangles, and views
 * follow the theme automatically where an SVG would need every fill threaded
 * through `useUnistyles`.
 *
 * The body color is a fixed beige, not a theme color, on purpose: it is
 * *depicting a physical object*, and a resistor is beige in both light and dark
 * mode. Only the surrounding chrome follows the theme. This is also why the
 * band colors come from the engine's `hex` values untouched — the whole tool is
 * worthless if the blue on screen is not the blue on the part.
 */

const BODY_COLOR = '#D8B98A';
const BODY_EDGE = '#B99A6B';
const LEAD_COLOR = '#9CA3AF';

export interface BandSlot {
    /** Message-catalog label, e.g. "1st digit". */
    label: string;
    color: ResistorColorId;
    onPress: () => void;
    selected: boolean;
}

export function ResistorBody({bands}: {bands: readonly BandSlot[]}) {
    return (
        <View style={styles.stage}>
            <View style={styles.lead} />
            <View style={styles.body}>
                {bands.map((band, index) => (
                    <Pressable
                        key={`${band.label}-${index}`}
                        accessibilityRole="button"
                        accessibilityState={{selected: band.selected}}
                        accessibilityLabel={band.label}
                        accessibilityValue={{text: band.color}}
                        onPress={band.onPress}
                        style={[styles.band, band.selected && styles.bandSelected]}
                    >
                        <View
                            style={[
                                styles.bandFill,
                                {backgroundColor: RESISTOR_COLORS[band.color].hex},
                            ]}
                        />
                    </Pressable>
                ))}
            </View>
            <View style={styles.lead} />
        </View>
    );
}

/**
 * The swatch row for the band currently being edited.
 *
 * Horizontally scrollable rather than wrapped: twelve swatches wrap to a ragged
 * two-and-a-bit rows on a narrow phone, and the row order (black…white, then
 * gold/silver) *is* the mnemonic, so keeping it one continuous strip preserves
 * the thing a user is reading it for.
 */
export function BandPalette({
    colors,
    value,
    onChange,
    labelFor,
}: {
    colors: readonly ResistorColorId[];
    value: ResistorColorId;
    onChange: (next: ResistorColorId) => void;
    labelFor: (color: ResistorColorId) => string;
}) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.palette}
        >
            {colors.map(color => {
                const selected = color === value;
                const swatch = RESISTOR_COLORS[color];
                return (
                    <Pressable
                        key={color}
                        accessibilityRole="radio"
                        accessibilityState={{selected}}
                        accessibilityLabel={labelFor(color)}
                        onPress={() => onChange(color)}
                        style={styles.swatchCell}
                    >
                        <View
                            style={[
                                styles.swatch,
                                {backgroundColor: swatch.hex},
                                selected && styles.swatchSelected,
                            ]}
                        >
                            {swatch.digit !== null ? (
                                <Text
                                    variant="micro"
                                    tabular
                                    style={
                                        swatch.textColor === 'light'
                                            ? styles.swatchTextLight
                                            : styles.swatchTextDark
                                    }
                                >
                                    {String(swatch.digit)}
                                </Text>
                            ) : null}
                        </View>
                        <Text
                            variant="micro"
                            color={selected ? 'brand' : 'textMuted'}
                            numberOfLines={1}
                            style={styles.swatchLabel}
                        >
                            {labelFor(color)}
                        </Text>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create(theme => ({
    stage: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.spacing.xl,
    },
    lead: {
        width: theme.spacing.xl,
        height: 3,
        backgroundColor: LEAD_COLOR,
        borderRadius: theme.radius.full,
    },
    body: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        height: 72,
        flex: 1,
        maxWidth: 280,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: BODY_COLOR,
        borderWidth: 1,
        borderColor: BODY_EDGE,
    },
    band: {
        height: '100%',
        paddingHorizontal: theme.spacing.xs,
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
    },
    bandSelected: {
        // The edit affordance is a ring around the band, not a color change:
        // changing the band to indicate selection would lie about the value.
        borderWidth: 2,
        borderColor: theme.colors.brand,
    },
    bandFill: {
        width: 16,
        height: '100%',
        borderRadius: 2,
    },
    palette: {
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.xs,
    },
    swatchCell: {
        alignItems: 'center',
        gap: theme.spacing.xs,
        width: 56,
    },
    swatch: {
        width: 40,
        height: 40,
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    swatchSelected: {
        borderWidth: 3,
        borderColor: theme.colors.brand,
    },
    swatchTextLight: {color: '#ffffff'},
    swatchTextDark: {color: '#111827'},
    swatchLabel: {textAlign: 'center'},
}));
