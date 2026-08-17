import {useMemo, useState} from 'react';
import {Pressable, View} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Text, Button, IconSymbol} from '@/components/ui';
import {Segmented} from '@/features/account/components/chrome';
import {
    RESISTANCE_UNITS,
    MAX_RESISTORS,
    MIN_RESISTORS,
    calculateEquivalentResistance,
    formatResistanceValue,
    type CircuitMode,
    type ResistanceUnit,
} from '@/lib/tools/series-parallel';
import {formatResistance} from '@/lib/tools/resistor-color-code';
import {useT} from '@/features/account/i18n';
import {parseNumericInput} from '@/features/tools/calc-state';
import {ValueField, Readout, Formulas, Education, Panel, CalcError, useUnitOptions} from './instrument';

/**
 * Series/parallel resistor combiner.
 *
 * Rows carry a stable `id` rather than being keyed by index: removing the
 * middle row of three would otherwise re-key the rows below it, and React
 * would re-use the removed row's `TextInput` state for its successor — the
 * value stays on screen while the row it belongs to is gone.
 */
interface Row {
    id: number;
    value: string;
    unit: ResistanceUnit;
}

let nextId = 0;
const makeRow = (value = ''): Row => ({id: nextId++, value, unit: 'kohm'});

export function SeriesParallelTool() {
    const t = useT('Tools.seriesParallel');
    const [mode, setMode] = useState<CircuitMode>('series');
    const [rows, setRows] = useState<Row[]>(() => [makeRow('1'), makeRow('2.2')]);

    const units = useUnitOptions(RESISTANCE_UNITS, t);

    const result = useMemo(
        () =>
            calculateEquivalentResistance(
                rows.map(row => ({value: parseNumericInput(row.value) ?? 0, unit: row.unit})),
                mode,
            ),
        [rows, mode],
    );

    const update = (id: number, patch: Partial<Row>) =>
        setRows(current => current.map(row => (row.id === id ? {...row, ...patch} : row)));

    return (
        <>
            <Panel title={t('mode')}>
                <Segmented
                    label={t('mode')}
                    value={mode}
                    onChange={setMode}
                    options={[
                        {value: 'series', label: t('series')},
                        {value: 'parallel', label: t('parallel')},
                    ]}
                />
            </Panel>

            <Panel>
                {rows.map((row, index) => (
                    <View key={row.id} style={styles.row}>
                        <View style={styles.rowField}>
                            <ValueField
                                label={t('resistor', {index: index + 1})}
                                value={row.value}
                                onChangeValue={value => update(row.id, {value})}
                                placeholder={t('enterValue')}
                                units={units}
                                unit={row.unit}
                                onChangeUnit={unit =>
                                    update(row.id, {unit: unit as ResistanceUnit})
                                }
                            />
                        </View>
                        {rows.length > MIN_RESISTORS ? (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={t('removeResistor')}
                                hitSlop={8}
                                onPress={() =>
                                    setRows(current => current.filter(item => item.id !== row.id))
                                }
                                style={styles.remove}
                            >
                                <IconSymbol name="trash" size={18} color="danger" />
                            </Pressable>
                        ) : null}
                    </View>
                ))}

                {rows.length < MAX_RESISTORS ? (
                    <Button
                        variant="secondary"
                        size="sm"
                        icon="add"
                        onPress={() => setRows(current => [...current, makeRow()])}
                    >
                        {t('addResistor')}
                    </Button>
                ) : null}
            </Panel>

            {result.error ? <CalcError>{t('invalidCombination')}</CalcError> : null}

            <Readout
                title={t('results')}
                rows={[
                    {
                        label: t('equivalent'),
                        value:
                            result.equivalentOhms === null
                                ? '—'
                                : formatResistance(result.equivalentOhms),
                        primary: true,
                    },
                    {
                        label: t('baseValue'),
                        value:
                            result.equivalentOhms === null
                                ? '—'
                                : `${formatResistanceValue(result.equivalentOhms)} Ω`,
                    },
                ]}
            />

            {result.equivalentOhms === null ? (
                <Text variant="caption" color="textMuted">
                    {t('invalidCombination')}
                </Text>
            ) : null}

            <Formulas title={t('formulas')} formulas={result.formulas} />

            <Education title={t('educationTitle')} body={t('educationBody')} />
        </>
    );
}

const styles = StyleSheet.create(theme => ({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: theme.spacing.sm,
    },
    rowField: {flex: 1},
    remove: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));
