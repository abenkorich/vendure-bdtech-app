import {useMemo, useState} from 'react';
import {View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Button} from '@/components/ui';
import {Segmented} from '@/features/account/components/chrome';
import {
    DIGIT_COLOR_IDS,
    MULTIPLIER_COLOR_IDS,
    TOLERANCE_COLOR_IDS,
    TEMP_COEF_COLOR_IDS,
    decodeResistor,
    getDefaultBands,
    parseResistanceInput,
    reverseLookupResistance,
    formatResistance,
    type BandCount,
    type ResistorColorId,
} from '@/lib/tools/resistor-color-code';
import {useT} from '@/features/account/i18n';
import {ResistorBody, BandPalette, type BandSlot} from './ResistorBands';
import {Readout, ValueField, Education, Panel, CalcError} from './instrument';

/**
 * Resistor color code — the flagship tool.
 *
 * The band count is the outer control because it changes the *shape* of the
 * part, not just a value. Band state is kept per count-shape (`digits` array
 * sized 2 or 3) and reset through `getDefaultBands` on a switch, rather than
 * being padded or truncated: carrying a stale third digit into a 4-band
 * resistor is how a decoder silently shows the wrong value.
 */

type EditTarget =
    | {kind: 'digit'; index: number}
    | {kind: 'multiplier'}
    | {kind: 'tolerance'}
    | {kind: 'tempCoef'};

const PALETTE: Record<EditTarget['kind'], readonly ResistorColorId[]> = {
    digit: DIGIT_COLOR_IDS,
    multiplier: MULTIPLIER_COLOR_IDS,
    tolerance: TOLERANCE_COLOR_IDS,
    tempCoef: TEMP_COEF_COLOR_IDS,
};

export function ResistorColorCodeTool() {
    const t = useT('Tools.resistorColorCode');

    const [bandCount, setBandCount] = useState<BandCount>(4);
    const [bands, setBands] = useState(() => getDefaultBands(4));
    const [target, setTarget] = useState<EditTarget>({kind: 'digit', index: 0});
    const [lookup, setLookup] = useState('');

    const result = useMemo(
        () => decodeResistor(bandCount, bands),
        [bandCount, bands],
    );

    const reverse = useMemo(() => {
        const ohms = parseResistanceInput(lookup);
        if (ohms === null) return null;
        return reverseLookupResistance(ohms, bandCount);
    }, [lookup, bandCount]);

    const changeBandCount = (next: BandCount) => {
        setBandCount(next);
        setBands(getDefaultBands(next));
        setTarget({kind: 'digit', index: 0});
    };

    const setColor = (color: ResistorColorId) => {
        setBands(current => {
            if (target.kind === 'digit') {
                const digits = [...current.digits];
                digits[target.index] = color;
                return {...current, digits};
            }
            return {...current, [target.kind]: color};
        });
    };

    const digitLabels = [t('band1'), t('band2'), t('band3')];

    const slots: BandSlot[] = [
        ...bands.digits.map((color, index) => ({
            label: digitLabels[index],
            color,
            selected: target.kind === 'digit' && target.index === index,
            onPress: () => setTarget({kind: 'digit', index}),
        })),
        {
            label: t('multiplier'),
            color: bands.multiplier,
            selected: target.kind === 'multiplier',
            onPress: () => setTarget({kind: 'multiplier'}),
        },
        {
            label: t('tolerance'),
            color: bands.tolerance,
            selected: target.kind === 'tolerance',
            onPress: () => setTarget({kind: 'tolerance'}),
        },
        ...(bandCount === 6 && bands.tempCoef
            ? [
                  {
                      label: t('tempCoef'),
                      color: bands.tempCoef,
                      selected: target.kind === 'tempCoef',
                      onPress: () => setTarget({kind: 'tempCoef'}),
                  },
              ]
            : []),
    ];

    const activeColor: ResistorColorId =
        target.kind === 'digit'
            ? bands.digits[target.index]
            : target.kind === 'multiplier'
              ? bands.multiplier
              : target.kind === 'tolerance'
                ? bands.tolerance
                : (bands.tempCoef ?? 'brown');

    const activeLabel =
        target.kind === 'digit'
            ? digitLabels[target.index]
            : target.kind === 'multiplier'
              ? t('multiplier')
              : target.kind === 'tolerance'
                ? t('tolerance')
                : t('tempCoef');

    return (
        <>
            <Panel>
                <Segmented
                    label={t('title')}
                    value={String(bandCount)}
                    onChange={value => changeBandCount(Number(value) as BandCount)}
                    options={[
                        {value: '4', label: t('bands4')},
                        {value: '5', label: t('bands5')},
                        {value: '6', label: t('bands6')},
                    ]}
                />

                <ResistorBody bands={slots} />

                <Text variant="micro" color="textMuted" uppercase>
                    {activeLabel}
                </Text>
                <BandPalette
                    colors={PALETTE[target.kind]}
                    value={activeColor}
                    onChange={setColor}
                    labelFor={color => t(`colors.${color}`)}
                />
            </Panel>

            {result ? (
                <Readout
                    title={t('result')}
                    rows={[
                        {label: t('result'), value: result.formatted, primary: true},
                        {label: t('exactValue'), value: result.exactOhms},
                        {
                            label: t('tolerance'),
                            value:
                                result.tolerancePercent === null
                                    ? '—'
                                    : `±${result.tolerancePercent}%`,
                        },
                        {
                            label: t('toleranceRange'),
                            value:
                                result.minOhms === null || result.maxOhms === null
                                    ? '—'
                                    : `${formatResistance(result.minOhms)} – ${formatResistance(result.maxOhms)}`,
                        },
                        ...(bandCount === 6
                            ? [
                                  {
                                      label: t('tempCoefValue'),
                                      value:
                                          result.tempCoefPpm === null
                                              ? '—'
                                              : `${result.tempCoefPpm} ppm/K`,
                                  },
                              ]
                            : []),
                    ]}
                />
            ) : (
                <CalcError>{t('noMatch')}</CalcError>
            )}

            <Panel title={t('reverseLookup')}>
                <Text variant="caption" color="textMuted">
                    {t('reverseLookupHint')}
                </Text>
                <ValueField
                    label={t('resistanceValue')}
                    value={lookup}
                    onChangeValue={setLookup}
                    placeholder={t('reversePlaceholder')}
                />
                {lookup.trim().length > 0 ? (
                    reverse ? (
                        <View style={styles.reverse}>
                            <Text variant="caption" color="textMuted">
                                {t('reverseFound', {value: formatResistance(reverse.ohms)})}
                            </Text>
                            <Button
                                variant="secondary"
                                size="sm"
                                onPress={() => {
                                    setBands({
                                        digits: reverse.digits,
                                        multiplier: reverse.multiplier,
                                        tolerance: reverse.tolerance,
                                        ...(reverse.tempCoef ? {tempCoef: reverse.tempCoef} : {}),
                                    });
                                }}
                            >
                                {t('applyBands')}
                            </Button>
                        </View>
                    ) : (
                        <Text variant="caption" color="danger">
                            {t('noMatch')}
                        </Text>
                    )
                ) : null}
            </Panel>

            <Education title={t('educationTitle')} body={t('educationBody')} />
        </>
    );
}

const styles = StyleSheet.create(theme => ({
    reverse: {gap: theme.spacing.sm, alignItems: 'flex-start'},
}));
