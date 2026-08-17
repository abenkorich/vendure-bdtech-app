import {useMemo, useState} from 'react';
import {Segmented} from '@/features/account/components/chrome';
import {
    RESISTANCE_UNITS,
    CAPACITANCE_UNITS,
    calculateAstable,
    calculateMonostable,
    formatFrequency,
    formatTime,
    formatTimerValue,
    type TimerMode,
    type ResistanceUnit,
    type CapacitanceUnit,
} from '@/lib/tools/555-timer';
import {useT} from '@/features/account/i18n';
import {parseNumericInput} from '@/features/tools/calc-state';
import {ValueField, Readout, Formulas, Education, Panel, useUnitOptions} from './instrument';

/**
 * 555 timer.
 *
 * Astable and monostable are separate input sets, not a shared one with a hidden
 * field: monostable has a single R, astable has two, and reusing "R1" as "R"
 * across the switch is how a user ends up computing a pulse width from the wrong
 * resistor. State is kept separately per mode so switching back restores what
 * was typed.
 */
export function Timer555Tool() {
    const t = useT('Tools.timer555');
    const [mode, setMode] = useState<TimerMode>('astable');

    const [r1, setR1] = useState({value: '10', unit: 'kohm' as ResistanceUnit});
    const [r2, setR2] = useState({value: '10', unit: 'kohm' as ResistanceUnit});
    const [rMono, setRMono] = useState({value: '100', unit: 'kohm' as ResistanceUnit});
    const [c, setC] = useState({value: '10', unit: 'uF' as CapacitanceUnit});

    const resistanceUnits = useUnitOptions(RESISTANCE_UNITS, t);
    const capacitanceUnits = useUnitOptions(CAPACITANCE_UNITS, t);

    const astable = useMemo(
        () =>
            calculateAstable({
                r1: parseNumericInput(r1.value) ?? 0,
                r1Unit: r1.unit,
                r2: parseNumericInput(r2.value) ?? 0,
                r2Unit: r2.unit,
                c: parseNumericInput(c.value) ?? 0,
                cUnit: c.unit,
            }),
        [r1, r2, c],
    );

    const monostable = useMemo(
        () =>
            calculateMonostable({
                r: parseNumericInput(rMono.value) ?? 0,
                rUnit: rMono.unit,
                c: parseNumericInput(c.value) ?? 0,
                cUnit: c.unit,
            }),
        [rMono, c],
    );

    const capacitor = (
        <ValueField
            label={t('capacitance')}
            value={c.value}
            onChangeValue={value => setC(current => ({...current, value}))}
            placeholder={t('enterValue')}
            units={capacitanceUnits}
            unit={c.unit}
            onChangeUnit={unit => setC(current => ({...current, unit: unit as CapacitanceUnit}))}
        />
    );

    return (
        <>
            <Panel>
                <Segmented
                    label={t('title')}
                    value={mode}
                    onChange={setMode}
                    options={[
                        {value: 'astable', label: t('astable')},
                        {value: 'monostable', label: t('monostable')},
                    ]}
                />
            </Panel>

            {mode === 'astable' ? (
                <>
                    <Panel>
                        <ValueField
                            label={t('r1')}
                            value={r1.value}
                            onChangeValue={value => setR1(current => ({...current, value}))}
                            placeholder={t('enterValue')}
                            units={resistanceUnits}
                            unit={r1.unit}
                            onChangeUnit={unit =>
                                setR1(current => ({...current, unit: unit as ResistanceUnit}))
                            }
                        />
                        <ValueField
                            label={t('r2')}
                            value={r2.value}
                            onChangeValue={value => setR2(current => ({...current, value}))}
                            placeholder={t('enterValue')}
                            units={resistanceUnits}
                            unit={r2.unit}
                            onChangeUnit={unit =>
                                setR2(current => ({...current, unit: unit as ResistanceUnit}))
                            }
                        />
                        {capacitor}
                    </Panel>

                    <Readout
                        title={t('results')}
                        rows={[
                            {
                                label: t('frequency'),
                                value: formatFrequency(astable.frequencyHz),
                                primary: true,
                            },
                            {label: t('period'), value: formatTime(astable.periodSeconds)},
                            {
                                label: t('dutyCycle'),
                                value:
                                    astable.dutyCyclePercent === null
                                        ? '—'
                                        : `${formatTimerValue(astable.dutyCyclePercent)} %`,
                            },
                        ]}
                    />

                    <Formulas title={t('formulas')} formulas={astable.formulas} />
                </>
            ) : (
                <>
                    <Panel>
                        <ValueField
                            label={t('resistance')}
                            value={rMono.value}
                            onChangeValue={value => setRMono(current => ({...current, value}))}
                            placeholder={t('enterValue')}
                            units={resistanceUnits}
                            unit={rMono.unit}
                            onChangeUnit={unit =>
                                setRMono(current => ({...current, unit: unit as ResistanceUnit}))
                            }
                        />
                        {capacitor}
                    </Panel>

                    <Readout
                        title={t('results')}
                        rows={[
                            {
                                label: t('pulseWidth'),
                                value: formatTime(monostable.pulseWidthSeconds),
                                primary: true,
                            },
                        ]}
                    />

                    <Formulas title={t('formulas')} formulas={monostable.formulas} />
                </>
            )}

            <Education title={t('educationTitle')} body={t('educationBody')} />
        </>
    );
}
