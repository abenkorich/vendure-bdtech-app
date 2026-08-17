import {useMemo, useState} from 'react';
import {
    VOLTAGE_UNITS,
    CURRENT_UNITS,
    RESISTANCE_UNITS,
    POWER_UNITS,
    type OhmsLawField,
} from '@/lib/tools/ohms-law';
import {useT} from '@/features/account/i18n';
import {
    solveOhmsLawState,
    initialOhmsLawState,
    type OhmsLawState,
} from '@/features/tools/calc-state';
import {ValueField, Readout, Formulas, Education, Panel, CalcError, useUnitOptions} from './instrument';

/**
 * Ohm's law.
 *
 * Every field is editable and every field is a readout. Rather than a mode
 * picker for "which one am I solving for", the first two fields carrying a
 * value are the inputs and the rest display what falls out — clearing a field
 * hands the role over. That is the behaviour of a bench instrument, and it
 * removes the state where a user has selected "solve for R" and typed R.
 *
 * The over-constrained case (three fields filled) is resolved in
 * `calc-state.ts` and covered by tests, since it is the one place this could
 * silently contradict itself.
 */
export function OhmsLawTool() {
    const t = useT('Tools.ohmsLaw');
    const [state, setState] = useState<OhmsLawState>(initialOhmsLawState);

    const result = useMemo(() => solveOhmsLawState(state), [state]);

    const units = {
        voltage: useUnitOptions(VOLTAGE_UNITS, t),
        current: useUnitOptions(CURRENT_UNITS, t),
        resistance: useUnitOptions(RESISTANCE_UNITS, t),
        power: useUnitOptions(POWER_UNITS, t),
    };

    const set = (field: OhmsLawField, patch: {value?: string; unit?: string}) =>
        setState(current => ({...current, [field]: {...current[field], ...patch}}));

    const fields: {field: OhmsLawField; label: string}[] = [
        {field: 'voltage', label: t('voltage')},
        {field: 'current', label: t('current')},
        {field: 'resistance', label: t('resistance')},
        {field: 'power', label: t('power')},
    ];

    const rowByField = Object.fromEntries(result.rows.map(row => [row.field, row]));

    return (
        <>
            <Panel>
                {fields.map(({field, label}) => (
                    <ValueField
                        key={field}
                        label={label}
                        value={state[field].value}
                        onChangeValue={value => set(field, {value})}
                        placeholder={t('enterValue')}
                        units={units[field]}
                        unit={state[field].unit}
                        onChangeUnit={unit => set(field, {unit})}
                    />
                ))}
            </Panel>

            {result.error === 'invalid_combination' ? (
                <CalcError>{t('invalidCombination')}</CalcError>
            ) : null}

            {/* The unit rides on the *value*, not the label: the catalog
                labels already read "Voltage (V)", so appending the selected
                unit there gives "Voltage (V) (V)". */}
            <Readout
                title={t('calculated')}
                rows={fields.map(({field, label}, index) => ({
                    label,
                    value: withUnit(rowByField[field]?.display, t(`units.${state[field].unit}`)),
                    primary: index === 0,
                    muted: rowByField[field]?.isInput,
                }))}
            />

            <Formulas title={t('formulas')} formulas={result.formulas} />

            <Education title={t('educationTitle')} body={t('educationBody')} />
        </>
    );
}

/** `0.12` + `A` -> `0.12 A`; an absent reading stays a bare dash. */
function withUnit(display: string | undefined, unit: string): string {
    return !display || display === '—' ? '—' : `${display} ${unit}`;
}
