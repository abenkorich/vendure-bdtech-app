import {useMemo, useState} from 'react';
import {VOLTAGE_UNITS, RESISTANCE_UNITS, type DividerField} from '@/lib/tools/voltage-divider';
import {useT} from '@/features/account/i18n';
import {
    solveDividerState,
    initialDividerState,
    formatCurrent,
    type DividerState,
} from '@/features/tools/calc-state';
import {ValueField, Readout, Formulas, Education, Panel, CalcError, useUnitOptions} from './instrument';

/**
 * Voltage divider. Same "first N filled fields are the inputs" rule as Ohm's
 * law, with three knowns instead of two, so the two tools behave identically
 * under the fingers.
 */
export function VoltageDividerTool() {
    const t = useT('Tools.voltageDivider');
    const [state, setState] = useState<DividerState>(initialDividerState);

    const result = useMemo(() => solveDividerState(state), [state]);

    const voltageUnits = useUnitOptions(VOLTAGE_UNITS, t);
    const resistanceUnits = useUnitOptions(RESISTANCE_UNITS, t);

    const set = (field: DividerField, patch: {value?: string; unit?: string}) =>
        setState(current => ({...current, [field]: {...current[field], ...patch}}));

    const fields: {field: DividerField; label: string; voltage: boolean}[] = [
        {field: 'vin', label: t('vin'), voltage: true},
        {field: 'r1', label: t('r1'), voltage: false},
        {field: 'r2', label: t('r2'), voltage: false},
        {field: 'vout', label: t('vout'), voltage: true},
    ];

    const rowByField = Object.fromEntries(result.rows.map(row => [row.field, row]));

    return (
        <>
            <Panel>
                {fields.map(({field, label, voltage}) => (
                    <ValueField
                        key={field}
                        label={label}
                        value={state[field].value}
                        onChangeValue={value => set(field, {value})}
                        placeholder={t('enterValue')}
                        units={voltage ? voltageUnits : resistanceUnits}
                        unit={state[field].unit}
                        onChangeUnit={unit => set(field, {unit})}
                    />
                ))}
            </Panel>

            {result.error === 'vout_exceeds_vin' ? (
                <CalcError>{t('voutExceedsVin')}</CalcError>
            ) : result.error === 'invalid_combination' ? (
                <CalcError>{t('invalidCombination')}</CalcError>
            ) : null}

            {/* Unit on the value, not appended to the label: the catalog
                labels already read "Input voltage (Vin)". */}
            <Readout
                title={t('results')}
                rows={[
                    ...fields.map(({field, label}) => {
                        const display = rowByField[field]?.display;
                        return {
                            label,
                            value:
                                !display || display === '—'
                                    ? '—'
                                    : `${display} ${t(`units.${state[field].unit}`)}`,
                            primary: field === 'vout',
                            muted: rowByField[field]?.isInput,
                        };
                    }),
                    {label: t('current'), value: formatCurrent(result.currentAmps)},
                ]}
            />

            <Formulas title={t('formulas')} formulas={result.formulas} />

            <Education title={t('educationTitle')} body={t('educationBody')} />
        </>
    );
}
